import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import type { ToolCallResult } from "@/server/agent/types";

type Args = {
  product_id?: string;
  part_number?: string;
  defect_code?: string;
  limit?: number;
};

export const queryDefects = async (args: Args): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("v_defect_detail")
    .select("defect_id,product_id,defect_ts,defect_code,severity,reported_part_number,reported_part_title,notes")
    .order("defect_ts", { ascending: false })
    .limit(args.limit ?? 15);

  if (args.product_id) query = query.eq("product_id", args.product_id);
  if (args.part_number) query = query.eq("reported_part_number", args.part_number);
  if (args.defect_code) query = query.eq("defect_code", args.defect_code);

  const { data, error } = await query;
  if (error) {
    throw new Error(`query_defects failed: ${error.message}`);
  }

  return {
    tool_call_id: makeId("TC"),
    tool: "query_defects",
    summary: `Fetched ${(data ?? []).length} defect rows.`,
    data: data ?? [],
  };
};
