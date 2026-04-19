import { z } from "zod";
import { closurePredicateSchema, legacyClosurePredicateSchema } from "./closure";

// ─── Initiative status ────────────────────────────────────────────────────────

export const initiativeStatusEnum = z.enum([
  "draft",
  "proposed",
  "approved",
  "dispatched",
  "failed",
  "done",
  "cancelled",
  "reopen",
  "rejected",
  "in_progress",
  "closed",
]);

// ─── Agent domains ────────────────────────────────────────────────────────────

export const agentDomainEnum = z.enum([
  "production",
  "supplier",
  "rnd",
  "logistics",
  "customer_response",
]);

// ─── Create input (Propose phase + engineer form) ─────────────────────────────

export const initiativeCreateSchema = z.object({
  incident_id: z.string(),
  agent_domain: agentDomainEnum,
  target_system: z.string(),
  owner_user_id: z.string().optional(),
  due_ts: z.string().datetime().optional(),
  status: initiativeStatusEnum.optional(),
  closure_predicate: legacyClosurePredicateSchema,
  product_id: z.string().optional(),
  defect_id: z.string().optional(),
  section_id: z.string().optional(),
  comments: z.string().optional(),
  // Extended
  cosign_required: z.boolean().optional(),
  dispatch_idempotency_key: z.string().optional(),
});

export type InitiativeCreateInput = z.infer<typeof initiativeCreateSchema>;

// ─── Row schema (DB reads) ────────────────────────────────────────────────────

export const initiativeRowSchema = z.object({
  initiative_id: z.string(),
  incident_id: z.string(),
  agent_domain: agentDomainEnum.or(z.string()),
  target_system: z.string().nullable().optional(),
  owner_user_id: z.string().nullable().optional(),
  due_ts: z.string().nullable().optional(),
  status: initiativeStatusEnum.or(z.string()),
  closure_predicate: z.unknown().nullable().optional(),
  product_id: z.string().nullable().optional(),
  defect_id: z.string().nullable().optional(),
  section_id: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  dispatched_at: z.string().nullable().optional(),
  closed_at: z.string().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
  product_action_id: z.string().nullable().optional(),
  target_ref: z.string().nullable().optional(),

  // Co-sign (spec §13.10)
  cosign_required: z.boolean().optional().default(false),
  co_signed: z.boolean().optional().default(false),
  co_signed_by_user_id: z.string().nullable().optional(),
  co_signed_at: z.string().nullable().optional(),

  // Dispatch tracking
  dispatch_idempotency_key: z.string().nullable().optional(),
  patience_until: z.string().nullable().optional(),
  consecutive_error_count: z.number().int().optional().default(0),

  // Closure monitor state
  last_check_result: z.unknown().nullable().optional(),
  last_checked_at: z.string().nullable().optional(),
});

export type InitiativeRow = z.infer<typeof initiativeRowSchema>;
