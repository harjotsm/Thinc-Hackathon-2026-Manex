import { describe, it, expect, vi } from "vitest";

// ─── Module mocks (must be before all imports that use them) ─────────────────
// server-only is not available in the test/node environment
vi.mock("server-only", () => ({}));

// Anthropic client — not needed for pure parser tests; mock to prevent key checks
vi.mock("@/lib/anthropic", () => ({ getAnthropicClient: vi.fn(() => null) }));

// Supabase — not used in parser tests but transitively imported
vi.mock("@/lib/supabase-server", () => ({ getSupabaseServerClient: vi.fn() }));

// event-bus — avoid EventEmitter import noise in test env
vi.mock("@/lib/event-bus", () => ({
  publishSessionEvent: vi.fn(),
  subscribeSessionEvents: vi.fn(),
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

// Tool registry — side-effect imports that pull in DB clients
vi.mock("@/server/tools/registry", () => ({
  nonWriteTools: vi.fn(() => []),
  invokeTool: vi.fn(),
  allTools: vi.fn(() => []),
}));
vi.mock("@/server/tools/_register", () => ({}));

import { parseClassifyOutput } from "../phases/classify";
import { parseDraft8DOutput, EvidenceCiteUnfixableError } from "../phases/compose";
import { parseInitiativesOutput } from "../phases/propose";

// ─── parseClassifyOutput ──────────────────────────────────────────────────────

describe("parseClassifyOutput", () => {
  it("parses a clean JSON response", () => {
    const raw = JSON.stringify({
      archetype: "supplier",
      signature_text: "Defective 100µF capacitors from ElektroParts batch SB-00007",
      initial_hypotheses: ["Supplier batch contamination", "Incoming inspection gap"],
      confidence: 0.85,
    });
    const result = parseClassifyOutput(raw);
    expect(result.archetype).toBe("supplier");
    expect(result.confidence).toBe(0.85);
    expect(result.initial_hypotheses).toHaveLength(2);
    expect(result.signature_text).toBeTruthy();
  });

  it("strips markdown code fences before parsing", () => {
    const raw = '```json\n{"archetype":"drift","signature_text":"Vibration sensor drift","initial_hypotheses":["Calibration issue"],"confidence":0.7}\n```';
    const result = parseClassifyOutput(raw);
    expect(result.archetype).toBe("drift");
    expect(result.confidence).toBe(0.7);
  });

  it("handles trailing noise after the JSON object", () => {
    const raw = '{"archetype":"operator","signature_text":"Operator rework variance","initial_hypotheses":["User error"],"confidence":0.6} Here is my reasoning...';
    const result = parseClassifyOutput(raw);
    expect(result.archetype).toBe("operator");
  });

  it("throws for invalid archetype", () => {
    const raw = JSON.stringify({
      archetype: "banana",
      signature_text: "test",
      initial_hypotheses: ["h1"],
      confidence: 0.5,
    });
    expect(() => parseClassifyOutput(raw)).toThrow();
  });

  it("throws when no JSON object is present", () => {
    expect(() => parseClassifyOutput("just some text without JSON")).toThrow(
      "parseClassifyOutput: no JSON object found",
    );
  });

  it("accepts all valid archetypes", () => {
    for (const archetype of ["supplier", "drift", "design", "operator", "unknown"] as const) {
      const raw = JSON.stringify({
        archetype,
        signature_text: "test sig",
        initial_hypotheses: ["h1"],
        confidence: 0.5,
      });
      expect(() => parseClassifyOutput(raw)).not.toThrow();
    }
  });

  it("rejects confidence outside 0-1", () => {
    const raw = JSON.stringify({
      archetype: "supplier",
      signature_text: "test",
      initial_hypotheses: ["h1"],
      confidence: 1.5,
    });
    expect(() => parseClassifyOutput(raw)).toThrow();
  });
});

// ─── parseDraft8DOutput ───────────────────────────────────────────────────────

describe("parseDraft8DOutput", () => {
  const validDraft = {
    problem: "Defective capacitors causing board failures in assembly line.",
    containment: [
      "Quarantine batch SB-00007 immediately.",
      "Increase incoming inspection on capacitors from ElektroParts.",
    ],
    likely_root_causes: [
      "ElektroParts batch SB-00007 shipped out-of-spec 100µF capacitors.",
      "Incoming QC sampling rate insufficient to catch marginal ESR.",
    ],
    evidence: ["TC-AAABBB001", "TC-CCCDDD002"],
    claims: [
      {
        claim: "Batch SB-00007 defect rate is elevated (TC-AAABBB001).",
        evidence: ["TC-AAABBB001"],
      },
    ],
  };

  it("parses a valid 8D draft", () => {
    const result = parseDraft8DOutput(JSON.stringify(validDraft));
    expect(result.problem).toBeTruthy();
    expect(result.containment).toHaveLength(2);
    expect(result.evidence).toHaveLength(2);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].evidence).toHaveLength(1);
  });

  it("strips markdown code fences", () => {
    const raw = "```json\n" + JSON.stringify(validDraft) + "\n```";
    expect(() => parseDraft8DOutput(raw)).not.toThrow();
  });

  it("throws when no JSON object is found", () => {
    expect(() => parseDraft8DOutput("no json here")).toThrow(
      "parseDraft8DOutput: no JSON object found",
    );
  });

  it("throws when claims have empty evidence array", () => {
    const bad = { ...validDraft, claims: [{ claim: "A claim", evidence: [] }] };
    expect(() => parseDraft8DOutput(JSON.stringify(bad))).toThrow();
  });

  it("throws when containment is empty array", () => {
    const bad = { ...validDraft, containment: [] };
    expect(() => parseDraft8DOutput(JSON.stringify(bad))).toThrow();
  });
});

// ─── parseInitiativesOutput ───────────────────────────────────────────────────

describe("parseInitiativesOutput", () => {
  const validInitiatives = [
    {
      title: "Quarantine and replace ElektroParts capacitors",
      domain: "supplier",
      target_system: "srm",
      owner_hint: "supplier_manager",
      rationale: "Evidence TC-AAABBB001 shows elevated defect rate in batch SB-00007.",
      confidence: 0.85,
      evidence: ["TC-AAABBB001"],
      closure_predicate: {
        type: "no_defect_code_in_window",
        params: { defect_code: "CAP_FAIL", days: 30, product_id: "PRD-00042" },
      },
    },
    {
      title: "Increase capacitor incoming inspection",
      domain: "production",
      target_system: "mes",
      owner_hint: "quality_team",
      rationale: "Current sampling rate missed batch defects per TC-CCCDDD002.",
      confidence: 0.75,
      evidence: ["TC-CCCDDD002"],
      closure_predicate: {
        type: "manual_confirmation",
        params: { confirmed_by: "quality_manager" },
      },
    },
  ];

  it("parses a valid initiatives array", () => {
    const result = parseInitiativesOutput(JSON.stringify(validInitiatives));
    expect(result).toHaveLength(2);
    expect(result[0].domain).toBe("supplier");
    expect(result[1].closure_predicate.type).toBe("manual_confirmation");
  });

  it("strips markdown code fences", () => {
    const raw = "```json\n" + JSON.stringify(validInitiatives) + "\n```";
    expect(() => parseInitiativesOutput(raw)).not.toThrow();
  });

  it("throws when no JSON array is found", () => {
    expect(() => parseInitiativesOutput("no array here")).toThrow(
      "parseInitiativesOutput: no JSON array found",
    );
  });

  it("throws for invalid domain", () => {
    const bad = [{ ...validInitiatives[0], domain: "logistics" }];
    expect(() => parseInitiativesOutput(JSON.stringify(bad))).toThrow();
  });

  it("throws when evidence is empty", () => {
    const bad = [{ ...validInitiatives[0], evidence: [] }];
    expect(() => parseInitiativesOutput(JSON.stringify(bad))).toThrow();
  });

  it("throws for unknown closure_predicate type", () => {
    const bad = [
      {
        ...validInitiatives[0],
        closure_predicate: { type: "unknown_type", params: {} },
      },
    ];
    expect(() => parseInitiativesOutput(JSON.stringify(bad))).toThrow();
  });

  it("accepts no_defect_code_in_window without optional product_id", () => {
    const withoutProduct = [
      {
        ...validInitiatives[0],
        closure_predicate: {
          type: "no_defect_code_in_window",
          params: { defect_code: "CAP_FAIL", days: 14 },
        },
      },
    ];
    expect(() => parseInitiativesOutput(JSON.stringify(withoutProduct))).not.toThrow();
  });
});

// ─── EvidenceCiteUnfixableError ───────────────────────────────────────────────

describe("EvidenceCiteUnfixableError", () => {
  it("is instanceof Error", () => {
    const err = new EvidenceCiteUnfixableError("test");
    expect(err instanceof Error).toBe(true);
  });

  it("has isEvidenceCiteUnfixable flag", () => {
    const err = new EvidenceCiteUnfixableError("test");
    expect(err.isEvidenceCiteUnfixable).toBe(true);
  });

  it("has correct name", () => {
    const err = new EvidenceCiteUnfixableError("test");
    expect(err.name).toBe("EvidenceCiteUnfixableError");
  });
});
