import { z } from "zod";

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
});

export type SignalCaptureInput = z.infer<typeof signalCaptureSchema>;

export const signalRowSchema = z.object({
  signal_id: z.string(),
  signal_type: z.string(),
  source_system: z.string(),
  captured_ts: z.string(),
  product_id: z.string().nullable().optional(),
  part_number: z.string().nullable().optional(),
  section_id: z.string().nullable().optional(),
  batch_id: z.string().nullable().optional(),
  severity_hint: z.number().nullable().optional(),
  text_payload: z.string().nullable().optional(),
  raw_payload: z.unknown(),
});

export type SignalRow = z.infer<typeof signalRowSchema>;

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
