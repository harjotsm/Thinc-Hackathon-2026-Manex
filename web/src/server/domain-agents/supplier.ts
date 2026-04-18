import type { DomainAgentContext, DomainInitiative } from "@/server/domain-agents/types";

export const buildSupplierInitiative = (ctx: DomainAgentContext): DomainInitiative => {
  const supplierContext = ctx.supplierName ? `supplier ${ctx.supplierName}` : "upstream supplier";
  return {
    title: "Supplier corrective action request",
    domain: "supplier",
    target_system: "srm_8d",
    owner_hint: "supplier_quality_owner",
    rationale: `Issue a formal 8D and incoming inspection containment for ${supplierContext}.`,
    confidence: 0.74,
    evidence: ctx.evidenceIds.slice(0, 3),
    closure_predicate: {
      type: "manual_confirmation",
      params: {
        confirmed_by: "supplier_quality_owner",
      },
    },
  };
};
