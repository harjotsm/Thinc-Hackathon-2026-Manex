import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const sessionPhaseEnum = z.enum([
  "classify",
  "investigate",
  "compose",
  "propose",
  "complete",
  "failed",
]);

export const sessionStatusEnum = z.enum([
  "running",
  "succeeded",
  "failed",
  "stalled",
  "cancelled",
]);

export const failureReasonEnum = z.enum([
  "max_turns",
  "stall_loop",
  "evidence_cite_unfixable",
  "model_refusal",
  "context_overflow",
  "api_error_exhausted",
  "tool_errors_exhausted",
  "aborted_by_user",
  "orchestrator_crash",
  "semantic_validator_failed",
]);

export const sessionTurnRoleEnum = z.enum(["assistant", "tool"]);

export const sessionEventTypeEnum = z.enum([
  "phase_start",
  "tool_call_start",
  "tool_call_result",
  "turn_complete",
  "phase_complete",
  "session_complete",
  "session_failed",
  "hint_provided",
]);

export const modelEnum = z.enum([
  "haiku-4-5",
  "sonnet-4-6",
  "opus-4-7",
]);

// ─── Session row ──────────────────────────────────────────────────────────────

export const sessionRowSchema = z.object({
  id: z.string(),                                          // "SES-xxxxx"
  incident_id: z.string(),
  phase: sessionPhaseEnum,
  status: sessionStatusEnum,
  started_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
  total_tokens_in: z.number().int().nullable().optional(),
  total_tokens_out: z.number().int().nullable().optional(),
  total_cost_usd: z.number().nullable().optional(),
  failure_reason: failureReasonEnum.nullable().optional(),
  created_by_user_id: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export type SessionRow = z.infer<typeof sessionRowSchema>;

// ─── Session turn row ─────────────────────────────────────────────────────────

export const sessionTurnToolCallSchema = z.object({
  tool_call_id: z.string(),
  name: z.string(),
  input: z.unknown(),
  output_ref: z.string().nullable().optional(),
  status: z.string().optional(),
  latency_ms: z.number().int().nullable().optional(),
  result_hash: z.string().nullable().optional(),
});

export const sessionTurnRowSchema = z.object({
  id: z.string(),                                          // "ST-<uuid>"
  session_id: z.string(),
  turn_index: z.number().int(),
  phase: sessionPhaseEnum,
  role: sessionTurnRoleEnum,
  model: modelEnum.nullable().optional(),
  content_text: z.string().nullable().optional(),          // ~2KB preview max
  tool_call: sessionTurnToolCallSchema.nullable().optional(),
  tokens_in: z.number().int().nullable().optional(),
  tokens_out: z.number().int().nullable().optional(),
  duration_ms: z.number().int().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export type SessionTurnRow = z.infer<typeof sessionTurnRowSchema>;

// ─── Session event (append-only log) ─────────────────────────────────────────

export const sessionEventRowSchema = z.object({
  session_id: z.string(),
  event_seq: z.number().int(),
  event_type: sessionEventTypeEnum.or(z.string()),
  payload: z.unknown(),
  ts: z.string(),
});

export type SessionEventRow = z.infer<typeof sessionEventRowSchema>;

export const sessionEventInsertSchema = z.object({
  session_id: z.string(),
  event_type: sessionEventTypeEnum.or(z.string()),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  ts: z.string().datetime().optional(),
});

export type SessionEventInsert = z.infer<typeof sessionEventInsertSchema>;
