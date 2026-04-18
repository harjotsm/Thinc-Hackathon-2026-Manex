import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  product_id: z.string().optional(),
  batch_id: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
type Input = z.infer<typeof Input>;

export const traceBatch = async (args: Input): Promise<ToolCallResult> => {
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
  if (error) throw new Error(`trace_batch failed: ${error.message}`);

  return {
    tool_call_id: makeId("TC"),
    tool: "trace_batch",
    summary: `Fetched ${(data ?? []).length} batch trace rows.`,
    data: data ?? [],
  };
};

registerTool({
  name: "trace_batch",
  description:
    "Trace product BOM and batch/supplier associations, optionally filtered by product_id or batch_id.",
  input_schema: Input,
  handler: async (input) => traceBatch(input),
  groups: ["retrieval"],
});
