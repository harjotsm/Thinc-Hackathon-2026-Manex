import { z } from "zod";

export const toolCallResultSchema = z.object({
  tool_call_id: z.string(),
  tool: z.string(),
  summary: z.string(),
  data: z.unknown(),
});

export const orchestratorResultSchema = z.object({
  incident_id: z.string(),
  archetype: z.enum(["supplier", "drift", "design", "operator", "unknown"]),
  tool_calls: z.array(toolCallResultSchema),
  draft_8d: z.object({
    problem: z.string(),
    containment: z.array(z.string()),
    likely_root_causes: z.array(z.string()),
    evidence: z.array(z.string()),
    claims: z.array(
      z.object({
        claim: z.string(),
        evidence: z.array(z.string()).min(1),
      }),
    ),
  }),
  initiatives: z.array(
    z.object({
      title: z.string(),
      domain: z.enum(["production", "supplier", "rnd"]),
      target_system: z.string(),
      owner_hint: z.string(),
      rationale: z.string(),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string()).min(1),
      closure_predicate: z.object({
        type: z.enum(["no_defect_code_in_window", "manual_confirmation"]),
        params: z.record(z.string(), z.unknown()),
      }),
    }),
  ),
  phases: z.array(
    z.object({
      phase: z.enum(["classify", "investigate", "compose", "propose"]),
      detail: z.string(),
    }),
  ),
});

export type OrchestratorResultSchema = z.infer<typeof orchestratorResultSchema>;
