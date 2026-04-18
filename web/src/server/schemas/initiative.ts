import { z } from "zod";

export const closurePredicateSchema = z.discriminatedUnion("type", [
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

export const initiativeCreateSchema = z.object({
  incident_id: z.string(),
  agent_domain: z.enum(["production", "supplier", "rnd", "logistics", "customer_response"]),
  target_system: z.string(),
  owner_user_id: z.string().optional(),
  due_ts: z.string().datetime().optional(),
  status: z.enum(["draft", "approved", "in_progress", "done", "reopen", "rejected"]).optional(),
  closure_predicate: closurePredicateSchema,
  product_id: z.string().optional(),
  defect_id: z.string().optional(),
  section_id: z.string().optional(),
  comments: z.string().optional(),
});

export type InitiativeCreateInput = z.infer<typeof initiativeCreateSchema>;
export type ClosurePredicate = z.infer<typeof closurePredicateSchema>;
