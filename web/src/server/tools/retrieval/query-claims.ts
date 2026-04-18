import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  product_id: z.string().optional(),
  part_number: z.string().optional(),
  article_id: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
type Input = z.infer<typeof Input>;

export const queryClaims = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("v_field_claim_detail")
    .select(
      "field_claim_id,product_id,claim_ts,article_id,article_name,reported_part_number,complaint_text,mapped_defect_code,mapped_defect_severity",
    )
    .order("claim_ts", { ascending: false })
    .limit(args.limit ?? 15);

  if (args.product_id) query = query.eq("product_id", args.product_id);
  if (args.part_number) query = query.eq("reported_part_number", args.part_number);
  if (args.article_id) query = query.eq("article_id", args.article_id);

  const { data, error } = await query;
  if (error) throw new Error(`query_claims failed: ${error.message}`);

  return {
    tool_call_id: makeId("TC"),
    tool: "query_claims",
    summary: `Fetched ${(data ?? []).length} claim rows.`,
    data: data ?? [],
  };
};

registerTool({
  name: "query_claims",
  description:
    "Fetch recent Manex field claim rows, optionally filtered by product/part/article.",
  input_schema: Input,
  handler: async (input) => queryClaims(input),
  groups: ["retrieval"],
});
