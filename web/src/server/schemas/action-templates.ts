import { z } from "zod";

// ─── Per-kind param schemas (spec §13.3) ──────────────────────────────────────

export const productionActionParamsSchema = z.object({
  product_id: z.string(),
  section_id: z.string().optional(),
  description: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
  defect_code: z.string().optional(),
  linked_part_ids: z.array(z.string()).optional(),
});

export const supplierNoticeParamsSchema = z.object({
  supplier_id: z.string(),
  subject: z.string(),
  body_markdown: z.string(),
  product_id: z.string().optional(),
  batch_id: z.string().optional(),
  part_number: z.string().optional(),
  recipients: z.array(z.string()).optional(),
  cc: z.array(z.string()).optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
});

export const designChangeRequestParamsSchema = z.object({
  product_id: z.string(),
  part_number: z.string().optional(),
  description: z.string(),
  body_markdown: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
  linked_part_ids: z.array(z.string()).optional(),
});

export const reworkDispatchParamsSchema = z.object({
  product_id: z.string(),
  section_id: z.string(),
  order_id: z.string().optional(),
  description: z.string(),
  defect_code: z.string().optional(),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export const customerResponseParamsSchema = z.object({
  customer_ref: z.string().optional(),
  subject: z.string(),
  body_markdown: z.string(),
  recipients: z.array(z.string()),
  cc: z.array(z.string()).optional(),
  market: z.string().optional(),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
});

export const logisticsHoldParamsSchema = z.object({
  product_id: z.string(),
  shipment_ref: z.string().optional(),
  batch_id: z.string().optional(),
  reason: z.string(),
  description: z.string(),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
});

export const internalNotificationParamsSchema = z.object({
  subject: z.string(),
  body_markdown: z.string(),
  recipients: z.array(z.string()),
  cc: z.array(z.string()).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
});

// ─── Action template discriminated union (spec §13.3) ─────────────────────────

export const actionTemplateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("production_action"),
    params: productionActionParamsSchema,
  }),
  z.object({
    kind: z.literal("supplier_notice"),
    params: supplierNoticeParamsSchema,
  }),
  z.object({
    kind: z.literal("design_change_request"),
    params: designChangeRequestParamsSchema,
  }),
  z.object({
    kind: z.literal("rework_dispatch"),
    params: reworkDispatchParamsSchema,
  }),
  z.object({
    kind: z.literal("customer_response"),
    params: customerResponseParamsSchema,
  }),
  z.object({
    kind: z.literal("logistics_hold"),
    params: logisticsHoldParamsSchema,
  }),
  z.object({
    kind: z.literal("internal_notification"),
    params: internalNotificationParamsSchema,
  }),
]);

export type ActionTemplate = z.infer<typeof actionTemplateSchema>;

// ─── Editable fields map (spec §13.4) — declarative per kind ─────────────────

export const editableFieldsByKind: Record<ActionTemplate["kind"], string[]> = {
  production_action: ["assigned_to", "due_date", "description", "priority"],
  supplier_notice: ["subject", "body_markdown", "recipients", "cc", "due_date", "assigned_to"],
  design_change_request: ["description", "body_markdown", "priority", "assigned_to", "due_date"],
  rework_dispatch: ["description", "assigned_to", "due_date", "priority"],
  customer_response: ["subject", "body_markdown", "recipients", "cc", "due_date", "assigned_to"],
  logistics_hold: ["reason", "description", "assigned_to", "due_date"],
  internal_notification: ["subject", "body_markdown", "recipients", "cc", "priority", "due_date", "assigned_to"],
};
