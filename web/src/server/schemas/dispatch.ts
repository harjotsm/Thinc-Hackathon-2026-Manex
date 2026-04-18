import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const dispatchStatusEnum = z.enum([
  "succeeded",
  "failed",
  "preview",
  "sent",
  "cancelled",
]);

export const targetSystemEnum = z.enum([
  "manex_native",
  "email_stub",
  "slack_stub",
  "supplier_portal_stub",
  "plm_stub",
]);

// ─── dispatch_attempt row (spec §13.5) ────────────────────────────────────────

export const dispatchAttemptRowSchema = z.object({
  id: z.string(),                                          // "DAT-xxxxx"
  initiative_id: z.string(),
  attempt_index: z.number().int().positive(),
  target_system: targetSystemEnum.or(z.string()),
  kind: z.string(),                                        // ActionTemplate.kind
  payload: z.unknown(),                                    // rendered template jsonb
  status: dispatchStatusEnum.or(z.string()),
  idempotency_key: z.string(),
  target_ref: z.string().nullable().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .nullable()
    .optional(),
  created_at: z.string().nullable().optional(),
  sent_at: z.string().nullable().optional(),
  sent_by_user_id: z.string().nullable().optional(),
  cancelled_at: z.string().nullable().optional(),
  cancelled_by_user_id: z.string().nullable().optional(),
});

export type DispatchAttemptRow = z.infer<typeof dispatchAttemptRowSchema>;

// ─── initiative_check row ─────────────────────────────────────────────────────

export const initiativeCheckResultEnum = z.enum([
  "pending",
  "passed",
  "failed",
  "error",
]);

export const initiativeCheckRowSchema = z.object({
  id: z.string(),                                          // "IC-<uuid>"
  initiative_id: z.string(),
  checked_at: z.string(),
  predicate_snapshot: z.unknown().nullable().optional(),
  result: initiativeCheckResultEnum,
  evidence: z.unknown().nullable().optional(),
  triggered_by: z.enum(["cron", "manual"]),
});

export type InitiativeCheckRow = z.infer<typeof initiativeCheckRowSchema>;
