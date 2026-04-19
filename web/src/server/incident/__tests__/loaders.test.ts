// @vitest-environment node
import { describe, it, expect } from "vitest";
import { deriveHypotheses, type ReportBundle } from "../loaders";

const makeReport = (overrides?: Partial<ReportBundle>): ReportBundle => ({
  report_id: "RPT-test",
  version: 1,
  composed_at: "2026-04-19T05:00:00Z",
  composed_by_model: "claude-sonnet-4-6",
  confidence: 0.8,
  draft_8d: {
    problem: "Power Module PM-00008 field failures clustered on supplier batch SB-00007.",
    containment: ["Quarantine batch SB-00007"],
    likely_root_causes: [
      "Supplier batch SB-00007 R33 capacitors with elevated ESR mean 0.28Ω vs spec 0.22Ω",
      "Reflow drift at Linie 1 station Stn-04 increasing solder defects since W49",
      "MC-200 design thermal margin insufficient for sustained load",
    ],
    evidence: ["SIG-408", "SIG-411", "SIG-412"],
    claims: [
      {
        claim: "Supplier batch SB-00007 ESR readings exceed acceptance limit at 0.28Ω.",
        evidence: ["SIG-408", "SIG-411"],
      },
      {
        claim: "Reflow profile drift detected at station Stn-04 from W49 onwards.",
        evidence: ["SIG-412"],
      },
    ],
  },
  archetype: "supplier",
  initiatives: [],
  tool_calls: [],
  ...overrides,
});

describe("deriveHypotheses", () => {
  it("returns one hypothesis per likely_root_cause and marks the first primary", () => {
    const report = makeReport();
    const hyps = deriveHypotheses(report);
    expect(hyps).toHaveLength(3);
    expect(hyps[0].isPrimary).toBe(true);
    expect(hyps[1].isPrimary).toBe(false);
    expect(hyps[2].isPrimary).toBe(false);
  });

  it("computes confidence higher for primary than for alternates and clamps to <= 0.92", () => {
    const report = makeReport();
    const hyps = deriveHypotheses(report);
    expect(hyps[0].confidence).toBeGreaterThan(hyps[1].confidence);
    for (const h of hyps) {
      expect(h.confidence).toBeLessThanOrEqual(0.92);
      expect(h.confidence).toBeGreaterThan(0);
    }
  });

  it("attaches supporting evidence by token-overlap with claims", () => {
    const report = makeReport();
    const hyps = deriveHypotheses(report);
    // Primary mentions "supplier", "batch" → matches first claim → ev SIG-408, SIG-411
    expect(hyps[0].supportingEvidence).toContain("SIG-408");
    expect(hyps[0].supportingEvidence).toContain("SIG-411");
    // Second mentions "reflow", "drift" → matches second claim → ev SIG-412
    expect(hyps[1].supportingEvidence).toContain("SIG-412");
  });

  it("guesses an archetype hint based on root-cause keywords", () => {
    const report = makeReport();
    const hyps = deriveHypotheses(report);
    expect(hyps[0].archetypeHint).toBe("Supplier");
    expect(hyps[1].archetypeHint).toBe("Process");
    expect(hyps[2].archetypeHint).toBe("Design");
  });

  it("returns empty array when likely_root_causes is empty", () => {
    const report = makeReport({
      draft_8d: {
        problem: "x",
        containment: [],
        likely_root_causes: [],
        evidence: [],
        claims: [],
      },
    });
    expect(deriveHypotheses(report)).toEqual([]);
  });

  it("falls back to top-level evidence for the primary if no claims overlap", () => {
    const report = makeReport({
      draft_8d: {
        problem: "Issue with widget",
        containment: ["x"],
        likely_root_causes: ["Mystery cause with no token overlap whatsoever"],
        evidence: ["SIG-001", "SIG-002"],
        claims: [{ claim: "Unrelated text", evidence: ["SIG-999"] }],
      },
    });
    const [primary] = deriveHypotheses(report);
    expect(primary.supportingEvidence.length).toBeGreaterThan(0);
    expect(primary.supportingEvidence).toContain("SIG-001");
  });
});
