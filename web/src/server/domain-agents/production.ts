import type { DomainAgentContext, DomainInitiative } from "@/server/domain-agents/types";

export const buildProductionInitiative = (ctx: DomainAgentContext): DomainInitiative => {
  const defectCode = ctx.primaryDefectCode ?? "SOLDER_COLD";
  return {
    title: "Production containment for affected flow",
    domain: "production",
    target_system: "manex_product_action",
    owner_hint: "plant_quality_lead",
    rationale:
      "Containment isolates potential defect propagation while investigation confirms root-cause confidence.",
    confidence: 0.82,
    evidence: ctx.evidenceIds.slice(0, 2),
    closure_predicate: {
      type: "no_defect_code_in_window",
      params: {
        product_id: ctx.productId,
        defect_code: defectCode,
        days: 14,
      },
    },
  };
};
