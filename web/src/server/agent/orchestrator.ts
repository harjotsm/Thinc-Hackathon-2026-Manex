import { getSupabaseServerClient } from "@/lib/supabase-server";
import { archetypePlaybooks } from "@/server/prompts/playbooks";
import { classifyArchetype } from "@/server/models/router";
import { invokeTool } from "@/server/tools/registry";
import "@/server/tools/_register"; // side-effect registrations
import { validateEvidenceContract } from "@/server/agent/evidence-validator";
import { buildProductionInitiative } from "@/server/domain-agents/production";
import { buildSupplierInitiative } from "@/server/domain-agents/supplier";
import { buildRndInitiative } from "@/server/domain-agents/rnd";
import type { OrchestratorResult, ToolCallResult } from "@/server/agent/types";

type IncidentSeed = {
  incident_id: string;
  title: string | null;
  summary: string | null;
  primary_product_id: string | null;
  primary_part: string | null;
};

const makeToolArgs = (incident: IncidentSeed) => ({
  incident_id: incident.incident_id,
  product_id: incident.primary_product_id ?? undefined,
  part_number: incident.primary_part ?? undefined,
  query: `${incident.title ?? ""} ${incident.summary ?? ""} ${incident.primary_part ?? ""}`.trim(),
});

// buildToolInput maps the orchestrator's flat args shape to each tool's Zod input shape
const buildToolInput = (toolName: string, args: ReturnType<typeof makeToolArgs>): unknown => {
  switch (toolName) {
    case "query_defects":
    case "query_claims":
      return { product_id: args.product_id, part_number: args.part_number };
    case "trace_batch":
      return { product_id: args.product_id };
    case "weekly_quality_summary":
      return {};
    case "semantic_search_complaints": // legacy playbook name — map to new
    case "semantic_search_signals":
      return { query_text: args.query };
    default:
      return args;
  }
};

const runTool = async (
  toolName: string,
  args: ReturnType<typeof makeToolArgs>,
): Promise<ToolCallResult> => {
  const input = buildToolInput(toolName, args);
  return invokeTool(toolName, input, { incident_id: args.incident_id });
};

const getPrimaryDefectCode = (toolCalls: ToolCallResult[]) => {
  const defectCall = toolCalls.find((call) => call.tool === "query_defects");
  if (!defectCall || !Array.isArray(defectCall.data) || defectCall.data.length === 0) {
    return undefined;
  }
  const first = defectCall.data[0] as Record<string, unknown>;
  const defectCode = first.defect_code;
  return typeof defectCode === "string" ? defectCode : undefined;
};

const getSupplierName = (toolCalls: ToolCallResult[]) => {
  const supplierCall = toolCalls.find((call) => call.tool === "trace_batch");
  if (!supplierCall || !Array.isArray(supplierCall.data) || supplierCall.data.length === 0) {
    return undefined;
  }
  const first = supplierCall.data[0] as Record<string, unknown>;
  const supplierName = first.supplier_name;
  return typeof supplierName === "string" ? supplierName : undefined;
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
  const primaryDefectCode = getPrimaryDefectCode(toolCalls);
  const supplierName = getSupplierName(toolCalls);
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
    claims: [
      {
        claim:
          primaryDefectCode !== undefined
            ? `Dominant defect signal suggests ${primaryDefectCode} as leading containment target.`
            : `Correlated quality signals indicate a non-random, multi-source incident pattern.`,
        evidence: evidenceIds.slice(0, 2),
      },
      {
        claim:
          supplierName !== undefined
            ? `Supplier context indicates upstream influence from ${supplierName}.`
            : "Cross-source complaints and in-plant indicators point to upstream/downstream coupling.",
        evidence: evidenceIds.slice(0, 3),
      },
    ],
  };
  phases.push({ phase: "compose", detail: "Built draft 8D projection with evidence references." });

  const initiatives: OrchestratorResult["initiatives"] = [
    buildProductionInitiative({
      incidentId,
      evidenceIds,
      productId: typedIncident.primary_product_id ?? undefined,
      partNumber: typedIncident.primary_part ?? undefined,
      primaryDefectCode,
      supplierName,
    }),
    buildSupplierInitiative({
      incidentId,
      evidenceIds,
      productId: typedIncident.primary_product_id ?? undefined,
      partNumber: typedIncident.primary_part ?? undefined,
      primaryDefectCode,
      supplierName,
    }),
    buildRndInitiative({
      incidentId,
      evidenceIds,
      productId: typedIncident.primary_product_id ?? undefined,
      partNumber: typedIncident.primary_part ?? undefined,
      primaryDefectCode,
      supplierName,
    }),
  ];
  phases.push({ phase: "propose", detail: "Generated 3 initiative candidates." });

  const result: OrchestratorResult = {
    incident_id: incidentId,
    archetype,
    tool_calls: toolCalls,
    draft_8d: draft8d,
    initiatives,
    phases,
  };

  const validation = validateEvidenceContract(result);
  if (!validation.ok) {
    throw new Error(
      `Evidence contract failed (L1/L3): ${validation.issues.map((i) => i.code).join(", ")}`,
    );
  }
  return result;
};
