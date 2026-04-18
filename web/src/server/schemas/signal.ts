import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const signalTypeEnum = z.enum([
  "operator_report",
  "engineer_report",
  "detector_anomaly",
  "field_claim",
  "factory_defect",
  "marginal_test",
]);

export const signalSourceEnum = z.enum([
  "operator",
  "engineer",
  "detector",
  "customer_email",
  "backfill_defect",
  "backfill_field_claim",
  "backfill_test_result",
]);

export const severityEnum = z.enum(["low", "medium", "high", "critical"]);

export const clusterStateEnum = z.enum([
  "attached",
  "pending_cluster",
  "expired",
]);

export const matchTypeEnum = z.enum([
  "det_prod_def",
  "det_sec_def",
  "det_rule",
  "sem",
  "new",
  "new_strong_detector",
  "pending",
  "expired",
]);

export const langEnum = z.enum(["de", "en"]);

export const shiftEnum = z.enum(["early", "late", "night"]);

// ─── Attachment descriptor (spec §3.4) ───────────────────────────────────────

export const attachmentSchema = z.object({
  kind: z.enum(["image", "audio"]),
  url: z.string(),
  vision_out: z.string().optional().nullable(),
  transcript: z.string().optional().nullable(),
  status: z.string().optional(),
});

// ─── Insert schema (correlator / intake writes to DB) ─────────────────────────

export const signalInsertSchema = z.object({
  // Required at insert
  signal_type: signalTypeEnum,
  source: signalSourceEnum,
  raw_text: z.string().min(1),
  severity: severityEnum,
  captured_ts: z.string().datetime(),
  idempotency_key: z.string().min(1),

  // Identity / routing
  source_system: z.string().optional().nullable(),
  source_ref: z.string().optional().nullable(),
  lang: langEnum.optional().nullable(),

  // Embedding — FLOAT8[] (pgvector unavailable)
  embedding: z.array(z.number()).length(1536).optional().nullable(),

  // Attachments
  attachments: z.array(attachmentSchema).optional().default([]),

  // Structured references
  product_id: z.string().optional().nullable(),
  part_number: z.string().optional().nullable(),
  reported_part_number: z.string().optional().nullable(),
  batch_id: z.string().optional().nullable(),
  section_id: z.string().optional().nullable(),
  defect_code: z.string().optional().nullable(),
  test_key: z.string().optional().nullable(),
  order_id: z.string().optional().nullable(),
  user_id: z.string().optional().nullable(),
  market: z.string().optional().nullable(),
  shift: shiftEnum.optional().nullable(),

  // Continuous severity score
  severity_hint: z.number().min(0).max(1).optional().nullable(),

  // LLM triage output {real:bool, reasoning:string, score:number}
  triage: z.unknown().optional().nullable(),

  // Incident link (set by correlator after correlate step)
  incident_id: z.string().optional().nullable(),
  created_by_user_id: z.string().optional().nullable(),

  // Detector-specific
  detector_rule: z.string().optional().nullable(),
  detector_evidence: z.unknown().optional().nullable(),

  // Full original record
  raw_payload: z.record(z.string(), z.unknown()).optional().nullable(),

  // Cluster state
  cluster_state: clusterStateEnum.optional().default("attached"),
  pending_until: z.string().datetime().optional().nullable(),

  // Correlator audit
  match_type: matchTypeEnum.optional().nullable(),
  match_score: z.number().optional().nullable(),
  attach_reason: z.string().optional().nullable(),
  matched_incident_id: z.string().optional().nullable(),

  // Legacy — kept for backward compat with correlator/run.ts
  text_payload: z.string().optional().nullable(),
});

export type SignalInsert = z.infer<typeof signalInsertSchema>;

// ─── Row schema (DB reads — all nullable-where-nullable) ─────────────────────

export const signalRowSchema = z.object({
  signal_id: z.string(),
  signal_type: signalTypeEnum.or(z.string()),
  source: signalSourceEnum.optional().nullable(),
  source_system: z.string().nullable().optional(),
  source_ref: z.string().nullable().optional(),
  raw_text: z.string().nullable().optional(),
  lang: langEnum.nullable().optional(),
  embedding: z.array(z.number()).length(1536).optional().nullable(),
  attachments: z.array(attachmentSchema).nullable().optional(),
  triage: z.unknown().nullable().optional(),

  // Structured refs
  product_id: z.string().nullable().optional(),
  part_number: z.string().nullable().optional(),
  reported_part_number: z.string().nullable().optional(),
  batch_id: z.string().nullable().optional(),
  section_id: z.string().nullable().optional(),
  defect_code: z.string().nullable().optional(),
  test_key: z.string().nullable().optional(),
  order_id: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
  market: z.string().nullable().optional(),
  shift: shiftEnum.nullable().optional(),

  severity: severityEnum.or(z.string()).optional().nullable(),
  severity_hint: z.number().nullable().optional(),

  captured_ts: z.string(),
  created_at: z.string().optional().nullable(),

  incident_id: z.string().nullable().optional(),
  created_by_user_id: z.string().nullable().optional(),

  detector_rule: z.string().nullable().optional(),
  detector_evidence: z.unknown().nullable().optional(),
  raw_payload: z.unknown().nullable().optional(),

  cluster_state: clusterStateEnum.optional().nullable(),
  pending_until: z.string().nullable().optional(),
  idempotency_key: z.string().optional(),

  match_type: matchTypeEnum.nullable().optional(),
  match_score: z.number().nullable().optional(),
  attach_reason: z.string().nullable().optional(),
  matched_incident_id: z.string().nullable().optional(),

  // Legacy
  text_payload: z.string().nullable().optional(),
});

export type SignalRow = z.infer<typeof signalRowSchema>;

// ─── Capture schema (intake API — keep + extend) ──────────────────────────────

export const signalCaptureSchema = z.object({
  signal_type: z.string().min(1),
  source_system: z.string().min(1),
  captured_ts: z.string().datetime().optional(),
  product_id: z.string().optional(),
  part_number: z.string().optional(),
  section_id: z.string().optional(),
  batch_id: z.string().optional(),
  severity_hint: z.number().min(0).max(1).optional(),
  text_payload: z.string().min(1).optional(),
  raw_payload: z.record(z.string(), z.unknown()).optional(),
  create_incident: z.boolean().optional(),
  // Extended fields
  attachments: z.array(attachmentSchema).optional(),
  idempotency_key: z.string().optional(),
  detector_rule: z.string().optional(),
});

export type SignalCaptureInput = z.infer<typeof signalCaptureSchema>;

export const signalCaptureResponseSchema = z.object({
  signal: signalRowSchema,
  correlator: z
    .object({
      linkedSignals: z.number().int().nonnegative(),
      incidentIds: z.array(z.string()),
    })
    .nullable(),
});

export type SignalCaptureResponse = z.infer<typeof signalCaptureResponseSchema>;
