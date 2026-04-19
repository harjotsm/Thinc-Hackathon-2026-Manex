import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  product_id: z.string().optional(),
  window_days: z.number().int().min(1).max(365).optional(),
  top_k: z.number().int().min(1).max(50).optional(),
});
type Input = z.infer<typeof Input>;

export const paretoDefectCodes = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();
  const windowDays = args.window_days ?? 30;
  const topK = args.top_k ?? 10;
  const sinceISO = new Date(Date.now() - windowDays * 86400_000).toISOString();

  let q = supabase
    .from("v_defect_detail")
    .select("defect_code,cost")
    .gte("defect_ts", sinceISO)
    .limit(10000);

  if (args.product_id) q = q.eq("product_id", args.product_id);

  const { data, error } = await q;
  if (error) throw new Error(`pareto_defect_codes failed: ${error.message}`);

  // Group in Node
  const counts = new Map<string, { n: number; cost_sum: number }>();
  for (const r of data ?? []) {
    const code = (r.defect_code as string | null) ?? "UNKNOWN";
    const existing = counts.get(code) ?? { n: 0, cost_sum: 0 };
    existing.n += 1;
    existing.cost_sum += (r.cost as number | null) ?? 0;
    counts.set(code, existing);
  }

  const sorted = Array.from(counts.entries())
    .map(([defect_code, { n, cost_sum }]) => ({ defect_code, count: n, cost_sum }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topK);

  return {
    tool_call_id: makeId("TC"),
    tool: "pareto_defect_codes",
    summary: `Pareto: top ${sorted.length} defect codes over last ${windowDays} days.`,
    data: sorted,
  };
};

registerTool({
  name: "pareto_defect_codes",
  description:
    "Compute Pareto ranking of defect codes by count over a rolling window. Aggregated in Node from v_defect_detail.",
  input_schema: Input,
  handler: async (input) => paretoDefectCodes(input),
  groups: ["retrieval"],
});
