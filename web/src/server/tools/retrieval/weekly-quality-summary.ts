import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  article_id: z.string().optional(),
  limit: z.number().int().min(1).max(52).optional(),
});
type Input = z.infer<typeof Input>;

export const weeklyQualitySummary = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("v_quality_summary")
    .select(
      "article_id,article_name,week_start,products_built,defect_count,claim_count,rework_count,avg_rework_minutes,defect_cost_sum,claim_cost_sum,top_defect_code",
    )
    .order("week_start", { ascending: false })
    .limit(args.limit ?? 12);

  if (args.article_id) query = query.eq("article_id", args.article_id);

  const { data, error } = await query;
  if (error) throw new Error(`weekly_quality_summary failed: ${error.message}`);

  return {
    tool_call_id: makeId("TC"),
    tool: "weekly_quality_summary",
    summary: `Fetched ${(data ?? []).length} quality summary rows.`,
    data: data ?? [],
  };
};

registerTool({
  name: "weekly_quality_summary",
  description:
    "Fetch weekly quality summary aggregates (defect/claim/rework counts), optionally filtered by article.",
  input_schema: Input,
  handler: async (input) => weeklyQualitySummary(input),
  groups: ["retrieval"],
});
