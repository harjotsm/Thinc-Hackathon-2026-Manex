import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  incident_id: z.string().min(1),
});
type Input = z.infer<typeof Input>;

export const contribSupplierQuality = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();

  // 1. Load incident + signals to find batch_id references
  const { data: signals, error: sigErr } = await supabase
    .from("signal")
    .select("signal_id,batch_id,reported_part_number,product_id")
    .eq("incident_id", args.incident_id)
    .not("batch_id", "is", null)
    .limit(50);

  if (sigErr) throw new Error(`contrib_supplier_quality: signals fetch failed: ${sigErr.message}`);

  const batchIds = [...new Set((signals ?? []).map((s) => s.batch_id as string).filter(Boolean))];
  const partNumbers = [
    ...new Set((signals ?? []).map((s) => s.reported_part_number as string | null).filter(Boolean)),
  ] as string[];

  // 2. BOM lookup for supplier info if batch_ids present
  let bomRows: Array<Record<string, unknown>> = [];
  if (batchIds.length > 0) {
    const { data: bom, error: bomErr } = await supabase
      .from("v_product_bom_parts")
      .select("batch_id,supplier_name,supplier_id,part_number,manufacturer_name")
      .in("batch_id", batchIds);
    if (bomErr) throw new Error(`contrib_supplier_quality: BOM fetch failed: ${bomErr.message}`);
    bomRows = (bom ?? []) as Array<Record<string, unknown>>;
  }

  const supplierNames = [...new Set(bomRows.map((r) => r.supplier_name as string).filter(Boolean))];

  // 3. Related field claims for same part numbers
  let claimCount = 0;
  if (partNumbers.length > 0) {
    const since90 = new Date(Date.now() - 90 * 86400_000).toISOString();
    const { data: claims } = await supabase
      .from("v_field_claim_detail")
      .select("field_claim_id")
      .in("reported_part_number", partNumbers)
      .gte("claim_ts", since90);
    claimCount = (claims ?? []).length;
  }

  // 4. Compose contribution
  const content = [
    `Supplier Quality Assessment for incident ${args.incident_id}`,
    ``,
    `Batches referenced in signals: ${batchIds.length > 0 ? batchIds.join(", ") : "none"}`,
    `Suppliers involved: ${supplierNames.length > 0 ? supplierNames.join(", ") : "none identified"}`,
    `Related field claims (last 90d, same parts): ${claimCount}`,
  ].join("\n");

  const structuredPayload = {
    batch_ids: batchIds,
    supplier_names: supplierNames,
    part_numbers: partNumbers,
    related_field_claims_90d: claimCount,
    bom_rows: bomRows,
  };

  // 5. UPSERT
  const contributionId = makeId("CTB");
  const { error: upsertErr } = await supabase
    .from("contribution")
    .upsert(
      {
        contribution_id: contributionId,
        incident_id: args.incident_id,
        domain: "supplier_quality",
        source: "tool",
        status: "available",
        content,
        structured_payload: structuredPayload,
        weight: 1.0,
        created_ts: new Date().toISOString(),
      },
      { onConflict: "incident_id,domain,source" },
    );

  if (upsertErr)
    throw new Error(`contrib_supplier_quality upsert failed: ${upsertErr.message}`);

  return {
    tool_call_id: makeId("TC"),
    tool: "contrib_supplier_quality",
    summary: `Supplier QA context: ${batchIds.length} batches from ${supplierNames.length} suppliers, ${claimCount} related field claims.`,
    data: {
      ok: true,
      contribution_id: contributionId,
      batches: batchIds.length,
      suppliers: supplierNames.length,
      field_claims_90d: claimCount,
    },
  };
};

registerTool({
  name: "contrib_supplier_quality",
  description:
    "Compose the supplier_quality contribution card for an incident, cross-referencing batch IDs and related field claims.",
  input_schema: Input,
  handler: async (input) => contribSupplierQuality(input),
  groups: ["contributions"],
});
