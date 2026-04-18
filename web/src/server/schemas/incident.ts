import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const incidentStatusSchema = z.enum([
  "triage",
  "reasoning",
  "resolving",
  "closed",
  "dismissed",
  "reopen",
]);

export const archetypeEnum = z.enum([
  "supplier",
  "drift",
  "design",
  "operator",
  "unknown",
]);

// Re-export severity from signal for convenience (same enum)
export const incidentSeverityEnum = z.enum(["low", "medium", "high", "critical"]);

// ─── Row schema ───────────────────────────────────────────────────────────────

export const incidentRowSchema = z.object({
  incident_id: z.string(),

  // Timestamps
  opened_ts: z.string().optional().nullable(),
  closed_ts: z.string().nullable().optional(),
  dismissed_at: z.string().nullable().optional(),
  reopened_at: z.string().nullable().optional(),
  last_activity_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),

  // State
  status: incidentStatusSchema,
  archetype: archetypeEnum.optional().default("unknown"),
  severity: incidentSeverityEnum.or(z.string()).nullable().optional(),
  is_provisional: z.boolean().optional().default(false),

  // Content
  title: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),

  // Product links
  primary_product_id: z.string().nullable().optional(),
  primary_part_number: z.string().nullable().optional(),
  // old field name kept for compat
  primary_part: z.string().nullable().optional(),
  linked_product_ids: z.array(z.string()).optional().default([]),

  // Signal aggregation
  signal_count: z.number().int().optional().default(0),

  // Embeddings — FLOAT8[] (pgvector unavailable)
  centroid_embedding: z.array(z.number()).length(1536).optional().nullable(),
  signature_text: z.string().nullable().optional(),
  signature_embedding: z.array(z.number()).length(1536).optional().nullable(),
  // Legacy embedding column (JSONB)
  embedding: z.unknown().nullable().optional(),

  // Hypothesis tree
  hypothesis_tree: z.unknown().nullable().optional(),
  hypothesis_tree_v2: z.unknown().nullable().optional(),

  // Co-sign
  cosign_required: z.boolean().optional().default(false),
  cosigned_by_user_id: z.string().nullable().optional(),
  cosigned_at: z.string().nullable().optional(),

  // Reopen / dismiss
  reopen_reason: z.string().nullable().optional(),
  dismiss_reason: z.string().nullable().optional(),
});

export type IncidentRow = z.infer<typeof incidentRowSchema>;
