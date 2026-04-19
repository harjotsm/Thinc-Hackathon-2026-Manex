import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  product_id: z.string().min(1),
});
type Input = z.infer<typeof Input>;

export const bomPartsForProduct = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("v_product_bom_parts")
    .select(
      "product_id,install_id,part_number,part_title,manufacturer_name,batch_id,batch_number,supplier_name,supplier_id,quality_status",
    )
    .eq("product_id", args.product_id);

  if (error) throw new Error(`bom_parts_for_product failed: ${error.message}`);

  const rows = data ?? [];
  return {
    tool_call_id: makeId("TC"),
    tool: "bom_parts_for_product",
    summary: `BOM for product ${args.product_id}: ${rows.length} part install rows.`,
    data: rows,
  };
};

registerTool({
  name: "bom_parts_for_product",
  description:
    "Fetch all BOM part installations for a product, with supplier and batch information.",
  input_schema: Input,
  handler: async (input) => bomPartsForProduct(input),
  groups: ["retrieval"],
});
