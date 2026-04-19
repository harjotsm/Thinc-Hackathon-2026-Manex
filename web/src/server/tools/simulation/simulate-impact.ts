import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const InitiativeCandidateSchema = z.object({
  agent_domain: z.string(),
  target_system: z.string(),
  product_id: z.string().optional(),
  defect_code: z.string().optional(),
  part_number: z.string().optional(),
});

const Input = z.object({
  initiative_candidate: InitiativeCandidateSchema,
  window_days: z.number().int().min(1).max(365).optional(),
});
type Input = z.infer<typeof Input>;

export const simulateImpact = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();
  const windowDays = args.window_days ?? 30;
  const productId = args.initiative_candidate.product_id;

  // Try to get a real 4-week baseline from v_quality_summary if product_id provided
  let baselineDefects = 0;
  let baselineCostEur = 0;
  let baselinePeriodStart: string | null = null;
  let baselinePeriodEnd: string | null = null;

  if (productId) {
    const { data } = await supabase
      .from("v_quality_summary")
      .select("week_start,defect_count,defect_cost_sum")
      .order("week_start", { ascending: false })
      .limit(4);

    if (data && data.length > 0) {
      for (const row of data) {
        baselineDefects += (row.defect_count as number) ?? 0;
        baselineCostEur += (row.defect_cost_sum as number) ?? 0;
      }
      baselinePeriodEnd = data[0]?.week_start as string ?? null;
      baselinePeriodStart = data[data.length - 1]?.week_start as string ?? null;
    }
  }

  // Heuristic: expect 20-40% reduction, cost saved = half of baseline cost
  const reductionPct = 20 + Math.floor(Math.random() * 21); // 20-40
  const costSaved = Math.round(baselineCostEur / 2);

  return {
    tool_call_id: makeId("TC"),
    tool: "simulate_impact",
    summary: `stub — heuristic impact estimate: ~${reductionPct}% defect reduction, ~€${costSaved} saved over ${windowDays}d.`,
    data: {
      expected_rate_reduction_pct: reductionPct,
      expected_cost_saved_eur: costSaved,
      baseline_defects_4w: baselineDefects,
      baseline_cost_eur_4w: baselineCostEur,
      baseline_period_start: baselinePeriodStart,
      baseline_period_end: baselinePeriodEnd,
      confidence: 0.4,
      method: "heuristic_stub",
    },
  };
};

registerTool({
  name: "simulate_impact",
  description:
    "Estimate impact of an initiative candidate using a heuristic model. Stub — not a real simulation model.",
  input_schema: Input,
  is_stub: true,
  handler: async (input) => simulateImpact(input),
  groups: ["simulation"],
});
