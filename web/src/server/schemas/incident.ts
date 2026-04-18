import { z } from "zod";

export const incidentStatusSchema = z.enum([
  "triage",
  "reasoning",
  "resolving",
  "closed",
  "dismissed",
]);

export const incidentRowSchema = z.object({
  incident_id: z.string(),
  opened_ts: z.string().optional(),
  closed_ts: z.string().nullable().optional(),
  status: incidentStatusSchema,
  title: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  severity: z.string().nullable().optional(),
  primary_product_id: z.string().nullable().optional(),
  primary_part: z.string().nullable().optional(),
  hypothesis_tree: z.unknown().nullable().optional(),
});

export type IncidentRow = z.infer<typeof incidentRowSchema>;
