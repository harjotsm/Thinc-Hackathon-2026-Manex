import { getSupabaseServerClient } from "@/lib/supabase-server";
import { archetypePlaybooks } from "@/server/prompts/playbooks";
import { classifyArchetype } from "@/server/models/router";
import { queryDefects } from "@/server/tools/query-defects";
import { queryClaims } from "@/server/tools/query-claims";
import { traceBatch } from "@/server/tools/trace-batch";
import { weeklyQualitySummary } from "@/server/tools/weekly-quality-summary";
import { semanticSearchComplaints } from "@/server/tools/semantic-search-complaints";
import type { OrchestratorResult, ToolCallResult } from "@/server/agent/types";

type IncidentSeed = {
  incident_id: string;
  title: string | null;
  summary: string | null;
  primary_product_id: string | null;
  primary_part: string | null;
};

const makeToolArgs = (incident: IncidentSeed) => ({
  product_id: incident.primary_product_id ?? undefined,
  part_number: incident.primary_part ?? undefined,
  query: `${incident.title ?? ""} ${incident.summary ?? ""} ${incident.primary_part ?? ""}`.trim(),
});

const runTool = async (tool: string, args: ReturnType<typeof makeToolArgs>): Promise<ToolCallResult> => {
  switch (tool) {
    case "query_defects":
      return queryDefects({ product_id: args.product_id, part_number: args.part_number });
    case "query_claims":
      return queryClaims({ product_id: args.product_id, part_number: args.part_number });
    case "trace_batch":
      return traceBatch({ product_id: args.product_id });
    case "weekly_quality_summary":
      return weeklyQualitySummary({});
    case "semantic_search_complaints":
      return semanticSearchComplaints({ query: args.query });
    default:
      throw new Error(`Unknown tool in playbook: ${tool}`);
  }
};

export const runOrchestrator = async (incidentId: string): Promise<OrchestratorResult> => {
  const supabase = getSupabaseServerClient();
  const { data: incident, error: incidentError } = await supabase
    .from("incident")
    .select("incident_id,title,summary,primary_product_id,primary_part")
    .eq("incident_id", incidentId)
    .single();

  if (incidentError || !incident) {
    throw new Error(`Incident not found: ${incidentError?.message ?? incidentId}`);
  }

  const typedIncident = incident as IncidentSeed;
  const phases: OrchestratorResult["phases"] = [];
  const summaryText = `${typedIncident.title ?? ""} ${typedIncident.summary ?? ""}`.trim();
  const archetype = await classifyArchetype(summaryText);
  phases.push({ phase: "classify", detail: `Archetype classified as ${archetype}.` });

  const playbook = archetypePlaybooks[archetype] ?? archetypePlaybooks.unknown;
  const args = makeToolArgs(typedIncident);
  const toolCalls: ToolCallResult[] = [];
  for (const tool of playbook) {
    const result = await runTool(tool, args);
    toolCalls.push(result);
  }
  phases.push({
    phase: "investigate",
    detail: `Executed ${toolCalls.length} tools: ${toolCalls.map((t) => t.tool).join(", ")}.`,
  });

  const evidenceIds = toolCalls.map((call) => call.tool_call_id);
  const draft8d: OrchestratorResult["draft_8d"] = {
    problem:
      typedIncident.summary ??
      "Correlated multi-source quality signals require coordinated cross-domain resolution.",
    containment: [
      "Quarantine affected products/batches immediately.",
      "Increase targeted inspection coverage for next production window.",
      "Notify relevant stakeholders with incident context.",
    ],
    likely_root_causes: [
      `Primary hypothesis (${archetype}) based on correlated signals and tool outputs.`,
      "Secondary hypotheses remain open until owner validation.",
    ],
    evidence: evidenceIds,
  };
  phases.push({ phase: "compose", detail: "Built draft 8D projection with evidence references." });

  const initiatives: OrchestratorResult["initiatives"] = [
    {
      title: "Production containment for affected flow",
      domain: "production",
      rationale: "Reduce immediate defect propagation while investigation closes.",
      confidence: 0.82,
      evidence: evidenceIds.slice(0, 2),
      closure_predicate: {
        type: "no_defect_code_in_window",
        params: { defect_code: "SOLDER_COLD", days: 14, product_id: typedIncident.primary_product_id ?? undefined },
      },
    },
    {
      title: "Supplier corrective action request",
      domain: "supplier",
      rationale: "Trace upstream batch and enforce corrective screening.",
      confidence: 0.74,
      evidence: evidenceIds.slice(0, 3),
      closure_predicate: {
        type: "manual_confirmation",
        params: { confirmed_by: "supplier_quality_lead" },
      },
    },
    {
      title: "R&D design/FMEA update",
      domain: "rnd",
      rationale: "Codify recurrence prevention in design and FMEA controls.",
      confidence: 0.66,
      evidence: evidenceIds.slice(0, 2),
      closure_predicate: {
        type: "manual_confirmation",
        params: { confirmed_by: "rnd_owner" },
      },
    },
  ];
  phases.push({ phase: "propose", detail: "Generated 3 initiative candidates." });

  return {
    incident_id: incidentId,
    archetype,
    tool_calls: toolCalls,
    draft_8d: draft8d,
    initiatives,
    phases,
  };
};
