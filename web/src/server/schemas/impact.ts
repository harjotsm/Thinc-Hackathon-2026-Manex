import { z } from "zod";

// ─── impact_measurement row (migration 00003) ─────────────────────────────────

export const impactMeasurementRowSchema = z.object({
  measurement_id: z.string(),
  initiative_id: z.string(),
  measured_ts: z.string(),
  metric: z.string(),
  value: z.number().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  method: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export type ImpactMeasurementRow = z.infer<typeof impactMeasurementRowSchema>;
