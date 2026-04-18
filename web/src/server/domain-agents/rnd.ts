import type { DomainAgentContext, DomainInitiative } from "@/server/domain-agents/types";

export const buildRndInitiative = (ctx: DomainAgentContext): DomainInitiative => {
  const partContext = ctx.partNumber ? `part ${ctx.partNumber}` : "affected component";
  return {
    title: "R&D design and FMEA update",
    domain: "rnd",
    target_system: "jira_fmea_registry",
    owner_hint: "rnd_quality_engineer",
    rationale: `Update design notes and FMEA controls for ${partContext} to prevent recurrence.`,
    confidence: 0.67,
    evidence: ctx.evidenceIds.slice(0, 2),
    closure_predicate: {
      type: "manual_confirmation",
      params: {
        confirmed_by: "rnd_quality_engineer",
      },
    },
  };
};
