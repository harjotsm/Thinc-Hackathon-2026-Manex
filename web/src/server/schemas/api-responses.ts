import { z } from "zod";

// ─── Shared response envelopes (spec §14.5) ───────────────────────────────────

// SessionEventEnvelope — SSE stream events
export const sessionEventEnvelopeSchema = z.object({
  seq: z.number().int(),
  event: z.string(),
  ts: z.string(),
  session_id: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export type SessionEventEnvelope = z.infer<typeof sessionEventEnvelopeSchema>;

// ErrorResponse — uniform error shape across all endpoints
export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  retryable: z.boolean(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// PaginationMeta — paginated list endpoints
export const paginationMetaSchema = z.object({
  page: z.number().int().nonnegative(),
  page_size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  has_next: z.boolean(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

// ─── Card shapes (spec §14.5) — lightweight list items ───────────────────────

export const signalCardSchema = z.object({
  signal_id: z.string(),
  signal_type: z.string(),
  severity: z.string().nullable().optional(),
  raw_text: z.string().nullable().optional(),
  captured_ts: z.string(),
  status: z.string().nullable().optional(),
  incident_id: z.string().nullable().optional(),
});

export type SignalCard = z.infer<typeof signalCardSchema>;

export const incidentCardSchema = z.object({
  incident_id: z.string(),
  title: z.string().nullable().optional(),
  status: z.string(),
  archetype: z.string().optional(),
  severity: z.string().nullable().optional(),
  signal_count: z.number().int().optional(),
  last_activity_at: z.string().nullable().optional(),
  primary_product_id: z.string().nullable().optional(),
});

export type IncidentCard = z.infer<typeof incidentCardSchema>;

export const sessionCardSchema = z.object({
  id: z.string(),
  incident_id: z.string(),
  phase: z.string(),
  status: z.string(),
  started_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
  total_tokens_in: z.number().int().nullable().optional(),
  total_tokens_out: z.number().int().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
});

export type SessionCard = z.infer<typeof sessionCardSchema>;

export const initiativeCardSchema = z.object({
  initiative_id: z.string(),
  incident_id: z.string(),
  status: z.string(),
  agent_domain: z.string(),
  target_system: z.string().nullable().optional(),
  owner_user_id: z.string().nullable().optional(),
  due_ts: z.string().nullable().optional(),
  cosign_required: z.boolean().optional(),
  co_signed: z.boolean().optional(),
});

export type InitiativeCard = z.infer<typeof initiativeCardSchema>;

export const lessonCardSchema = z.object({
  lesson_id: z.string(),
  incident_id: z.string().nullable().optional(),
  signature_text: z.string(),
  archetype: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  engineer_validated: z.string().optional(),
  created_ts: z.string().nullable().optional(),
  seed_source: z.string().nullable().optional(),
});

export type LessonCard = z.infer<typeof lessonCardSchema>;

export const reportSectionSchema = z.object({
  key: z.string(),
  text: z.string(),
  evidence: z.array(z.string()).optional().default([]),
});

export type ReportSection = z.infer<typeof reportSectionSchema>;

export const closureCheckCardSchema = z.object({
  id: z.string(),
  initiative_id: z.string(),
  checked_at: z.string(),
  result: z.string(),
  triggered_by: z.enum(["cron", "manual"]),
  evidence: z.unknown().optional(),
});

export type ClosureCheckCard = z.infer<typeof closureCheckCardSchema>;

export const evidenceRefSchema = z.object({
  tool_call_id: z.string().optional(),
  deep_link: z.string().optional(),
  summary: z.string().optional(),
});

export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
