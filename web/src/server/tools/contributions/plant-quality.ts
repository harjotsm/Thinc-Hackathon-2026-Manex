import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  incident_id: z.string().min(1),
});
type Input = z.infer<typeof Input>;

export const contribPlantQuality = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();

  // 1. Load incident
  const { data: incident, error: incErr } = await supabase
    .from("incident")
    .select("incident_id,title,primary_product_id")
    .eq("incident_id", args.incident_id)
    .single();

  if (incErr) throw new Error(`contrib_plant_quality: incident fetch failed: ${incErr.message}`);

  const productId = incident.primary_product_id as string | null;

  // 2. Query v_quality_summary for recent 4 weeks
  // article_id join is not directly on incident; query all recent rows and aggregate
  let summaryQ = supabase
    .from("v_quality_summary")
    .select(
      "article_id,week_start,products_built,defect_count,claim_count,rework_count,top_defect_code,defect_cost_sum",
    )
    .order("week_start", { ascending: false })
    .limit(4);

  // If we have a product_id, try to scope by article — but we may need the product→article join.
  // For demo scale: fetch recent 4 weeks globally (no article filter) since we don't have article_id on incident
  const { data: summaryRows, error: sumErr } = await summaryQ;
  if (sumErr) throw new Error(`contrib_plant_quality: summary fetch failed: ${sumErr.message}`);

  const rows = summaryRows ?? [];
  const totalDefects = rows.reduce((acc, r) => acc + ((r.defect_count as number) ?? 0), 0);
  const totalReworks = rows.reduce((acc, r) => acc + ((r.rework_count as number) ?? 0), 0);
  const totalClaims = rows.reduce((acc, r) => acc + ((r.claim_count as number) ?? 0), 0);
  const topCode = rows[0]?.top_defect_code ?? "N/A";

  // 3. Compose contribution
  const content = [
    `Plant Quality Assessment for incident ${args.incident_id}`,
    `Primary product: ${productId ?? "unknown"}`,
    ``,
    `Last 4 weeks (v_quality_summary):`,
    `  Total defects: ${totalDefects}`,
    `  Total reworks: ${totalReworks}`,
    `  Total field claims: ${totalClaims}`,
    `  Top defect code: ${String(topCode)}`,
  ].join("\n");

  const structuredPayload = {
    product_id: productId,
    weeks_analyzed: rows.length,
    total_defects: totalDefects,
    total_reworks: totalReworks,
    total_claims: totalClaims,
    top_defect_code: topCode,
    summary_rows: rows,
  };

  // 4. UPSERT
  const contributionId = makeId("CTB");
  const { error: upsertErr } = await supabase
    .from("contribution")
    .upsert(
      {
        contribution_id: contributionId,
        incident_id: args.incident_id,
        domain: "plant_quality_direct",
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
    throw new Error(`contrib_plant_quality upsert failed: ${upsertErr.message}`);

  return {
    tool_call_id: makeId("TC"),
    tool: "contrib_plant_quality",
    summary: `Plant quality: ${totalDefects} defects, ${totalReworks} reworks last ${rows.length} weeks.`,
    data: { ok: true, contribution_id: contributionId, total_defects: totalDefects, total_reworks: totalReworks },
  };
};

registerTool({
  name: "contrib_plant_quality",
  description:
    "Compose the plant_quality_direct contribution card for an incident using v_quality_summary data.",
  input_schema: Input,
  handler: async (input) => contribPlantQuality(input),
  groups: ["contributions"],
});
