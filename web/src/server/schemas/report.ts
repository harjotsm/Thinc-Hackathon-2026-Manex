import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const reportStatusEnum = z.enum(["draft", "current", "superseded"]);

export const visualizationTypeEnum = z.enum([
  "pareto",
  "timeline",
  "fishbone",
  "fmea",
  "bom",
]);

// ─── 8D structure (spec §7.5) ─────────────────────────────────────────────────
// D1-D8 keys. D1 (team) has a different shape from the rest.

const evidenceTextSection = z.object({
  text: z.string(),
  evidence: z.array(z.string()).min(0),
});

export const report8DSchema = z.object({
  // D1 — Team
  team: z.object({
    members: z.array(
      z.object({
        user_id: z.string(),
        role: z.string(),
      })
    ),
    evidence: z.array(z.string()).min(0).optional().default([]),
  }),
  // D2 — Problem description
  problem: evidenceTextSection,
  // D3 — Containment actions
  containment: evidenceTextSection,
  // D4 — Root cause
  root_cause: evidenceTextSection,
  // D5 — Corrective actions
  corrective_action: evidenceTextSection,
  // D6 — Verification of effectiveness
  verification: evidenceTextSection,
  // D7 — Preventive actions
  preventive_action: evidenceTextSection,
  // D8 — Closure / congratulation
  closure: evidenceTextSection,
});

export type Report8D = z.infer<typeof report8DSchema>;

// ─── Visualization descriptor ─────────────────────────────────────────────────

export const visualizationSchema = z.object({
  type: visualizationTypeEnum,
  data_query: z.string(),                     // reference key or SQL template id (no free-form SQL)
  caption: z.string().optional(),
  evidence: z.array(z.string()).min(0).optional().default([]),
});

export type Visualization = z.infer<typeof visualizationSchema>;

// ─── Report row ───────────────────────────────────────────────────────────────

export const reportRowSchema = z.object({
  id: z.string(),                                          // "REP-xxxxx"
  incident_id: z.string(),
  session_id: z.string(),
  version: z.number().int().positive(),
  status: reportStatusEnum,
  report_8d: report8DSchema.nullable().optional(),
  visualizations: z.array(visualizationSchema).nullable().optional(),
  composed_by_model: z.string().nullable().optional(),
  composed_at: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  compose_tokens_in: z.number().int().nullable().optional(),
  compose_tokens_out: z.number().int().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export type ReportRow = z.infer<typeof reportRowSchema>;
