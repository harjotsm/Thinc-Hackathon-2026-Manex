import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  product_id: z.string().optional(),
  window_days: z.number().int().min(1).max(365).optional(),
});
type Input = z.infer<typeof Input>;

export const fieldVsFactoryGap = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();
  const windowDays = args.window_days ?? 90;
  const since = new Date(Date.now() - windowDays * 86400_000).toISOString();

  let fieldQ = supabase
    .from("v_field_claim_detail")
    .select("mapped_defect_code,product_id")
    .not("mapped_defect_code", "is", null)
    .gte("claim_ts", since)
    .limit(5000);

  let factQ = supabase
    .from("v_defect_detail")
    .select("defect_code,product_id")
    .gte("defect_ts", since)
    .limit(5000);

  if (args.product_id) {
    fieldQ = fieldQ.eq("product_id", args.product_id);
    factQ = factQ.eq("product_id", args.product_id);
  }

  const [{ data: fieldData, error: fieldErr }, { data: factData, error: factErr }] =
    await Promise.all([fieldQ, factQ]);

  if (fieldErr) throw new Error(`field_vs_factory_gap (field) failed: ${fieldErr.message}`);
  if (factErr) throw new Error(`field_vs_factory_gap (factory) failed: ${factErr.message}`);

  // Accumulate field counts
  const fieldMap = new Map<string, { count: number; product_ids: Set<string> }>();
  for (const r of fieldData ?? []) {
    const code = r.mapped_defect_code as string;
    const existing = fieldMap.get(code) ?? { count: 0, product_ids: new Set() };
    existing.count += 1;
    if (r.product_id) existing.product_ids.add(r.product_id as string);
    fieldMap.set(code, existing);
  }

  // Accumulate factory codes
  const factorySet = new Set<string>();
  for (const r of factData ?? []) {
    if (r.defect_code) factorySet.add(r.defect_code as string);
  }

  // Set-diff: codes in field but not in factory
  const gap = Array.from(fieldMap.entries())
    .filter(([code]) => !factorySet.has(code))
    .map(([defect_code, { count, product_ids }]) => ({
      defect_code,
      field_count: count,
      factory_count: 0,
      product_ids: Array.from(product_ids),
    }))
    .sort((a, b) => b.field_count - a.field_count);

  return {
    tool_call_id: makeId("TC"),
    tool: "field_vs_factory_gap",
    summary: `Found ${gap.length} defect codes in field claims but absent from factory defects over ${windowDays}d.`,
    data: gap,
  };
};

registerTool({
  name: "field_vs_factory_gap",
  description:
    "Identify defect codes present in field claims but absent from factory defects — signals design/thermal drift story (Story 3).",
  input_schema: Input,
  handler: async (input) => fieldVsFactoryGap(input),
  groups: ["cross-boundary"],
});
