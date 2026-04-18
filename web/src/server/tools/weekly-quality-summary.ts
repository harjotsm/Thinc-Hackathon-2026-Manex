import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import type { ToolCallResult } from "@/server/agent/types";

type Args = {
  article_id?: string;
  limit?: number;
};

export const weeklyQualitySummary = async (args: Args): Promise<ToolCallResult> => {
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
  if (error) {
    throw new Error(`weekly_quality_summary failed: ${error.message}`);
  }

  return {
    tool_call_id: makeId("TC"),
    tool: "weekly_quality_summary",
    summary: `Fetched ${(data ?? []).length} quality summary rows.`,
    data: data ?? [],
  };
};
