import { z } from "zod";
import { archetypeEnum } from "./incident";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const engineerValidatedEnum = z.enum(["pending", "approved", "rejected"]);

// ─── Lesson triggers shape ────────────────────────────────────────────────────

export const lessonTriggersSchema = z.object({
  defect_codes: z.array(z.string()).optional().default([]),
  product_ids: z.array(z.string()).optional().default([]),
  detector_rules: z.array(z.string()).optional().default([]),
  section_patterns: z.array(z.string()).optional().default([]),
});

// ─── Lesson row (spec §11.1) ──────────────────────────────────────────────────
// Full 22-column shape

export const lessonRowSchema = z.object({
  lesson_id: z.string(),                                   // "LES-xxxxx"
  incident_id: z.string().nullable().optional(),
  signature_text: z.string(),
  embedding: z.array(z.number()).length(1536).optional().nullable(),
  outcome: z.string().nullable().optional(),
  fix_summary: z.string().nullable().optional(),
  created_ts: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  archetype: archetypeEnum.nullable().optional(),
  signature_embedding: z.array(z.number()).length(1536).optional().nullable(),
  prompt_snippet: z.string().nullable().optional(),
  triggers: lessonTriggersSchema.nullable().optional(),
  root_cause: z.string().nullable().optional(),
  root_cause_evidence: z
    .object({
      tool_call_ids: z.array(z.string()).optional().default([]),
      key_queries: z.array(z.string()).optional().default([]),
    })
    .nullable()
    .optional(),
  initiatives_taken: z
    .array(
      z.object({
        agent_domain: z.string(),
        target_system: z.string(),
        action_template: z.string().optional(),
      })
    )
    .nullable()
    .optional(),
  initiatives_outcome: z.unknown().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  engineer_validated: engineerValidatedEnum.optional().default("pending"),
  validated_by_user_id: z.string().nullable().optional(),
  validated_at: z.string().nullable().optional(),
  superseded_by: z.string().nullable().optional(),
  seed_source: z.string().nullable().optional(),
  source_session_id: z.string().nullable().optional(),
});

export type LessonRow = z.infer<typeof lessonRowSchema>;

// ─── lesson_usage row (spec §11.1) ────────────────────────────────────────────

export const lessonUsageRowSchema = z.object({
  id: z.string(),                                          // "LU-<uuid>"
  lesson_id: z.string(),
  session_id: z.string().nullable().optional(),
  incident_id: z.string(),
  used_at: z.string(),
  cosine_score: z.number().nullable().optional(),
});

export type LessonUsageRow = z.infer<typeof lessonUsageRowSchema>;

// ─── Seeder input (spec §11.2) ────────────────────────────────────────────────

export const lessonSeedInputSchema = z.object({
  incident_id: z.string(),
  source_session_id: z.string().optional(),
  signature_text: z.string().min(10),
  archetype: archetypeEnum,
  root_cause: z.string(),
  fix_summary: z.string(),
  triggers: lessonTriggersSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  seed_source: z.string().optional().default("demo"),
});

export type LessonSeedInput = z.infer<typeof lessonSeedInputSchema>;
