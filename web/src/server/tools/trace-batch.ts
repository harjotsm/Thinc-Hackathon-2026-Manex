import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import type { ToolCallResult } from "@/server/agent/types";

type Args = {
  batch_id?: string;
  product_id?: string;
  limit?: number;
};

export const traceBatch = async (args: Args): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("v_product_bom_parts")
    .select(
      "product_id,part_number,part_title,batch_id,batch_number,supplier_name,supplier_id,position_code,bom_node_id,find_number",
    )
    .order("product_id", { ascending: true })
    .limit(args.limit ?? 30);

  if (args.batch_id) query = query.eq("batch_id", args.batch_id);
  if (args.product_id) query = query.eq("product_id", args.product_id);

  const { data, error } = await query;
  if (error) {
    throw new Error(`trace_batch failed: ${error.message}`);
  }

  return {
    tool_call_id: makeId("TC"),
    tool: "trace_batch",
    summary: `Fetched ${(data ?? []).length} batch trace rows.`,
    data: data ?? [],
  };
};
