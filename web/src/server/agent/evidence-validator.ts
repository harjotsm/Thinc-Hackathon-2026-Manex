import type { OrchestratorResult } from "@/server/agent/types";

const ensureKnownEvidence = (evidence: string[], knownIds: Set<string>, context: string) => {
  if (evidence.length === 0) {
    throw new Error(`Evidence contract violation: "${context}" has no evidence IDs.`);
  }

  for (const evidenceId of evidence) {
    if (!knownIds.has(evidenceId)) {
      throw new Error(
        `Evidence contract violation: "${context}" references unknown tool_call_id "${evidenceId}".`,
      );
    }
  }
};

export const validateEvidenceContract = (result: OrchestratorResult) => {
  const knownToolCallIds = new Set(result.tool_calls.map((call) => call.tool_call_id));
  if (knownToolCallIds.size === 0) {
    throw new Error("Evidence contract violation: no tool calls were emitted.");
  }

  ensureKnownEvidence(result.draft_8d.evidence, knownToolCallIds, "draft_8d");
  for (const claim of result.draft_8d.claims) {
    ensureKnownEvidence(claim.evidence, knownToolCallIds, `claim "${claim.claim}"`);
  }

  for (const initiative of result.initiatives) {
    ensureKnownEvidence(initiative.evidence, knownToolCallIds, `initiative "${initiative.title}"`);
  }
};
