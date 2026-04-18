import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import type { ToolCallResult } from "@/server/agent/types";

type Args = {
  query: string;
  limit?: number;
};

export const semanticSearchComplaints = async (args: Args): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();
  const tokens = args.query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .slice(0, 5);

  let query = supabase
    .from("v_field_claim_detail")
    .select("field_claim_id,product_id,claim_ts,reported_part_number,complaint_text,article_id,article_name")
    .order("claim_ts", { ascending: false })
    .limit(args.limit ?? 20);

  if (tokens.length > 0) {
    const ilike = tokens.map((token) => `complaint_text.ilike.%${token}%`).join(",");
    query = query.or(ilike);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`semantic_search_complaints failed: ${error.message}`);
  }

  return {
    tool_call_id: makeId("TC"),
    tool: "semantic_search_complaints",
    summary: `Fetched ${(data ?? []).length} complaint rows with lexical semantic approximation.`,
    data: data ?? [],
  };
};
