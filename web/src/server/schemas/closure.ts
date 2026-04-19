import { z } from "zod";

// ─── Metric / Filter spec helpers ─────────────────────────────────────────────
// Predefined query templates — no free-form SQL (arch non-negotiable §2)

export const metricSpecSchema = z.object({
  metric: z.string(),                              // e.g. "defect_rate", "rework_delta", "field_claim_rate"
  product_id: z.string().optional(),
  part_number: z.string().optional(),
  section_id: z.string().optional(),
  supplier_id: z.string().optional(),
});

export const filterSpecSchema = z.object({
  table: z.string(),                               // e.g. "defect", "field_claim"
  product_id: z.string().optional(),
  defect_code: z.string().optional(),
  section_id: z.string().optional(),
  user_id: z.string().optional(),
});

// ─── Closure predicate discriminated union (spec §12.2) ──────────────────────

export const closurePredicateSchema: z.ZodType<ClosurePredicate> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    // metric_below_threshold — covers field_claim_rate_below, rework_delta_below, etc.
    z.object({
      kind: z.literal("metric_below_threshold"),
      metric_spec: metricSpecSchema,
      threshold: z.number(),
      window_days: z.number().int().positive(),
      start_from: z.enum(["dispatch_time", "explicit_date"]),
      start_date: z.string().optional(),
    }),

    // count_stayed_at_value — covers no_defect_code_in_window (count=0)
    z.object({
      kind: z.literal("count_stayed_at_value"),
      filter_spec: filterSpecSchema,
      value: z.number(),
      window_days: z.number().int().positive(),
    }),

    // composite — AND / OR of child predicates
    z.object({
      kind: z.literal("composite"),
      op: z.enum(["and", "or"]),
      children: z.array(z.lazy(() => closurePredicateSchema)),
    }),

    // external_state_check — evaluates dispatch_attempt.status for stubs (spec §13.11)
    z.object({
      kind: z.literal("external_state_check"),
      target_system: z.string(),
      target_ref: z.string(),
      expected_state: z.string(),
    }),
  ])
);

// ─── Legacy variants (kept for backward compat with initiative.ts) ────────────
// These are thin wrappers around the canonical kinds above, exposed for
// callers that still use the old "type" discriminant.

export const legacyClosurePredicateSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("no_defect_code_in_window"),
    params: z.object({
      product_id: z.string().optional(),
      defect_code: z.string(),
      days: z.number().int().positive(),
    }),
  }),
  z.object({
    type: z.literal("manual_confirmation"),
    params: z.object({
      confirmed_by: z.string().optional(),
    }),
  }),
]);

export type LegacyClosurePredicate = z.infer<typeof legacyClosurePredicateSchema>;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClosurePredicate =
  | {
      kind: "metric_below_threshold";
      metric_spec: z.infer<typeof metricSpecSchema>;
      threshold: number;
      window_days: number;
      start_from: "dispatch_time" | "explicit_date";
      start_date?: string;
    }
  | {
      kind: "count_stayed_at_value";
      filter_spec: z.infer<typeof filterSpecSchema>;
      value: number;
      window_days: number;
    }
  | {
      kind: "composite";
      op: "and" | "or";
      children: ClosurePredicate[];
    }
  | {
      kind: "external_state_check";
      target_system: string;
      target_ref: string;
      expected_state: string;
    };
