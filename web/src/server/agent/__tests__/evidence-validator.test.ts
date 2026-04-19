import { describe, it, expect } from "vitest";
import {
  validateStructured,
  validatePostValidator,
  validateEvidenceContract,
  buildRetryPrompt,
} from "../evidence-validator";
import type { OrchestratorResult } from "../types";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const makeToolCall = (id: string) => ({
  tool_call_id: id,
  tool: "query_defects",
  summary: "Result summary",
  data: [],
});

const makeInitiative = (
  evidenceIds: string[],
  title = "Test initiative",
): OrchestratorResult["initiatives"][0] => ({
  title,
  domain: "production",
  target_system: "erp",
  owner_hint: "quality_team",
  rationale: "Based on data.",
  confidence: 0.8,
  evidence: evidenceIds,
  closure_predicate: { type: "manual_confirmation", params: {} },
});

const makeResult = (
  overrides: Partial<OrchestratorResult> = {},
): OrchestratorResult => ({
  incident_id: "INC-001",
  archetype: "supplier",
  tool_calls: [makeToolCall("TC-001"), makeToolCall("TC-002")],
  draft_8d: {
    problem: "Parts failing at assembly.",
    containment: ["Quarantine batch SB-00007."],
    likely_root_causes: ["Supplier capacitor drift."],
    evidence: ["TC-001", "TC-002"],
    claims: [
      {
        claim: "ElektroParts batch defective.",
        evidence: ["TC-001"],
      },
    ],
  },
  initiatives: [makeInitiative(["TC-001", "TC-002"])],
  phases: [{ phase: "classify", detail: "Classified." }],
  ...overrides,
});

// ─── L1: validateStructured ───────────────────────────────────────────────────

describe("validateStructured (L1)", () => {
  it("rejects when there are no tool calls", () => {
    const result = makeResult({ tool_calls: [] });
    const r = validateStructured(result);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "no_tool_calls")).toBe(true);
  });

  it("accepts a result with valid evidence references", () => {
    const r = validateStructured(makeResult());
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("rejects a claim with an unknown tool_call_id", () => {
    const result = makeResult({
      draft_8d: {
        ...makeResult().draft_8d,
        claims: [
          {
            claim: "A claim with bad evidence.",
            evidence: ["TC-HALLUCINATED"],
          },
        ],
      },
    });
    const r = validateStructured(result);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "unknown_tool_call_id")).toBe(true);
  });

  it("rejects an initiative with an unknown tool_call_id", () => {
    const result = makeResult({
      initiatives: [makeInitiative(["TC-GHOST"])],
    });
    const r = validateStructured(result);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "unknown_tool_call_id")).toBe(true);
  });

  it("rejects draft_8d with unknown evidence id", () => {
    const result = makeResult({
      draft_8d: {
        ...makeResult().draft_8d,
        evidence: ["TC-UNKNOWN"],
      },
    });
    const r = validateStructured(result);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "unknown_tool_call_id")).toBe(true);
  });
});

// ─── L3: validatePostValidator ────────────────────────────────────────────────

describe("validatePostValidator (L3)", () => {
  it("rejects a problem statement with a bare number but no nearby citation", () => {
    const result = makeResult({
      draft_8d: {
        ...makeResult().draft_8d,
        problem:
          "47 defects were found in the assembly line with no citation nearby.",
      },
    });
    const r = validatePostValidator(result);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "uncited_numeric_claim")).toBe(true);
  });

  it("accepts a problem statement with a nearby tool_call_id citation", () => {
    const result = makeResult({
      draft_8d: {
        ...makeResult().draft_8d,
        problem: "47 defects found (TC-001) in the batch.",
      },
    });
    const r = validatePostValidator(result);
    // TC-001 is within 140 chars of "47"
    expect(r.ok).toBe(true);
  });

  it("flags a hallucinated TC- reference in narrative text", () => {
    const result = makeResult({
      initiatives: [
        {
          ...makeInitiative(["TC-001"]),
          rationale: "Based on TC-FAKE data indicating issues.",
        },
      ],
    });
    const r = validatePostValidator(result);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "hallucinated_tool_call_id")).toBe(true);
  });

  it("does not flag year numbers as uncited numeric claims", () => {
    const result = makeResult({
      draft_8d: {
        ...makeResult().draft_8d,
        problem: "Issue started in 2024 with no further numbers.",
      },
    });
    const r = validatePostValidator(result);
    // 2024 is a year pattern — should not be flagged
    const yearIssues = r.issues.filter(
      (i) => i.code === "uncited_numeric_claim" && i.context?.includes("problem"),
    );
    expect(yearIssues).toHaveLength(0);
  });
});

// ─── validateEvidenceContract (combined) ─────────────────────────────────────

describe("validateEvidenceContract (combined L1 + L3)", () => {
  it("returns ok=true for a fully valid result", () => {
    const result = makeResult();
    const r = validateEvidenceContract(result);
    expect(r.ok).toBe(true);
  });

  it("returns ok=false and combined issues when both L1 and L3 fail", () => {
    const result = makeResult({
      tool_calls: [makeToolCall("TC-001")],
      draft_8d: {
        problem: "47 defects (no citation).",
        containment: [],
        likely_root_causes: [],
        evidence: ["TC-999"], // L1 violation
        claims: [],
      },
      initiatives: [makeInitiative(["TC-001"])],
    });
    const r = validateEvidenceContract(result);
    expect(r.ok).toBe(false);
    const layers = r.issues.map((i) => i.layer);
    expect(layers).toContain(1);
    expect(layers).toContain(3);
  });
});

// ─── buildRetryPrompt ─────────────────────────────────────────────────────────

describe("buildRetryPrompt", () => {
  it("includes all issue codes in the prompt", () => {
    const issues = validateStructured(makeResult({ tool_calls: [] })).issues;
    const prompt = buildRetryPrompt(issues);
    expect(prompt).toContain("no_tool_calls");
    expect(prompt).toContain("corrected JSON");
  });
});
