export type ToolCallResult = {
  tool_call_id: string;
  tool: string;
  summary: string;
  data: unknown;
};

export type PhaseName = "classify" | "investigate" | "compose" | "propose";

export type OrchestratorResult = {
  incident_id: string;
  archetype: "supplier" | "drift" | "design" | "operator" | "unknown";
  tool_calls: ToolCallResult[];
  draft_8d: {
    problem: string;
    containment: string[];
    likely_root_causes: string[];
    evidence: string[];
    claims: Array<{
      claim: string;
      evidence: string[];
    }>;
  };
  initiatives: Array<{
    title: string;
    domain: "production" | "supplier" | "rnd";
    target_system: string;
    owner_hint: string;
    rationale: string;
    confidence: number;
    evidence: string[];
    closure_predicate: {
      type: "no_defect_code_in_window" | "manual_confirmation";
      params: Record<string, unknown>;
    };
  }>;
  phases: Array<{ phase: PhaseName; detail: string }>;
};
