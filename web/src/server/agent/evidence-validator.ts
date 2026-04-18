import type { OrchestratorResult } from "@/server/agent/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidationIssue = {
  layer: 1 | 2 | 3;
  code: string;
  message: string;
  context?: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};

// ─── L1: Structured evidence-cite check ──────────────────────────────────────

/**
 * L1 validator: every evidence[] entry in every claim and initiative must
 * reference a tool_call_id that was actually emitted in this run.
 * Also requires at least one tool call to have been made.
 */
export const validateStructured = (result: OrchestratorResult): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const knownIds = new Set(result.tool_calls.map((c) => c.tool_call_id));

  if (knownIds.size === 0) {
    issues.push({
      layer: 1,
      code: "no_tool_calls",
      message: "Evidence contract violation: no tool calls were emitted.",
    });
    return { ok: false, issues };
  }

  // Check draft_8d top-level evidence
  if (result.draft_8d.evidence.length === 0) {
    issues.push({
      layer: 1,
      code: "empty_evidence",
      message: 'Evidence contract violation: "draft_8d" has no evidence IDs.',
      context: "draft_8d",
    });
  }
  for (const id of result.draft_8d.evidence) {
    if (!knownIds.has(id)) {
      issues.push({
        layer: 1,
        code: "unknown_tool_call_id",
        message: `Evidence contract violation: "draft_8d" references unknown tool_call_id "${id}".`,
        context: "draft_8d",
      });
    }
  }

  // Check per-claim evidence
  for (const claim of result.draft_8d.claims) {
    if (claim.evidence.length === 0) {
      issues.push({
        layer: 1,
        code: "empty_evidence",
        message: `Evidence contract violation: claim "${claim.claim}" has no evidence IDs.`,
        context: `claim: ${claim.claim}`,
      });
    }
    for (const id of claim.evidence) {
      if (!knownIds.has(id)) {
        issues.push({
          layer: 1,
          code: "unknown_tool_call_id",
          message: `Evidence contract violation: claim "${claim.claim}" references unknown tool_call_id "${id}".`,
          context: `claim: ${claim.claim}`,
        });
      }
    }
  }

  // Check per-initiative evidence
  for (const initiative of result.initiatives) {
    if (initiative.evidence.length === 0) {
      issues.push({
        layer: 1,
        code: "empty_evidence",
        message: `Evidence contract violation: initiative "${initiative.title}" has no evidence IDs.`,
        context: `initiative: ${initiative.title}`,
      });
    }
    for (const id of initiative.evidence) {
      if (!knownIds.has(id)) {
        issues.push({
          layer: 1,
          code: "unknown_tool_call_id",
          message: `Evidence contract violation: initiative "${initiative.title}" references unknown tool_call_id "${id}".`,
          context: `initiative: ${initiative.title}`,
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
};

// ─── L3: Post-validator (numeric-claim + hallucinated-id scan) ────────────────

/**
 * Numeric pattern: matches standalone numbers (including decimals and percent).
 * - Negative lookbehind for hyphen/letter prevents matching IDs like SB-00007, PA-00101.
 * - We skip year-like 4-digit numbers (1900-2099) to avoid false positives on dates.
 */
const NUMERIC_RE = /(?<![-A-Za-z_])\b(\d+(?:\.\d+)?%?)\b/g;
const YEAR_RE = /\b(19|20)\d{2}\b/;

/**
 * Check whether a number in a text segment has a nearby tool_call_id citation.
 * "Nearby" = within 140 characters of the numeric token.
 */
const hasNearbyCitation = (
  text: string,
  matchIndex: number,
  knownIds: Set<string>,
): boolean => {
  const start = Math.max(0, matchIndex - 140);
  const end = Math.min(text.length, matchIndex + 140);
  const window = text.slice(start, end);
  for (const id of knownIds) {
    if (window.includes(id)) return true;
  }
  return false;
};

/**
 * Scan a block of free text for:
 * 1. Numeric claims without a nearby tool_call_id citation.
 * 2. Any string that looks like a tool_call_id format but is NOT in the known set
 *    (potential hallucinated references).
 */
const scanTextForViolations = (
  text: string,
  knownIds: Set<string>,
  contextLabel: string,
  issues: ValidationIssue[],
): void => {
  // L3a: bare numbers without citation
  let m: RegExpExecArray | null;
  NUMERIC_RE.lastIndex = 0;
  while ((m = NUMERIC_RE.exec(text)) !== null) {
    const num = m[1];
    // Skip year-like patterns
    if (YEAR_RE.test(num)) continue;
    if (!hasNearbyCitation(text, m.index, knownIds)) {
      issues.push({
        layer: 3,
        code: "uncited_numeric_claim",
        message: `Numeric value "${num}" in "${contextLabel}" has no nearby tool_call_id citation.`,
        context: contextLabel,
      });
    }
  }

  // L3b: hallucinated tool_call_id — strings that match the TC- prefix pattern but aren't known
  const TC_REF_RE = /\bTC-[A-Z0-9]+\b/g;
  TC_REF_RE.lastIndex = 0;
  let tcMatch: RegExpExecArray | null;
  while ((tcMatch = TC_REF_RE.exec(text)) !== null) {
    if (!knownIds.has(tcMatch[0])) {
      issues.push({
        layer: 3,
        code: "hallucinated_tool_call_id",
        message: `Reference "${tcMatch[0]}" in "${contextLabel}" is not a known tool_call_id.`,
        context: contextLabel,
      });
    }
  }
};

/**
 * L3 validator: scan all free-text narrative fields for uncited numbers and
 * hallucinated tool_call_id references.
 */
export const validatePostValidator = (result: OrchestratorResult): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const knownIds = new Set(result.tool_calls.map((c) => c.tool_call_id));

  // Scan 8D problem statement
  scanTextForViolations(result.draft_8d.problem, knownIds, "draft_8d.problem", issues);

  // Scan containment steps
  result.draft_8d.containment.forEach((step, i) => {
    scanTextForViolations(step, knownIds, `draft_8d.containment[${i}]`, issues);
  });

  // Scan root causes
  result.draft_8d.likely_root_causes.forEach((cause, i) => {
    scanTextForViolations(cause, knownIds, `draft_8d.likely_root_causes[${i}]`, issues);
  });

  // Scan claim text
  result.draft_8d.claims.forEach((claim) => {
    scanTextForViolations(claim.claim, knownIds, `claim: "${claim.claim}"`, issues);
  });

  // Scan initiative rationale
  result.initiatives.forEach((initiative) => {
    scanTextForViolations(
      initiative.rationale,
      knownIds,
      `initiative "${initiative.title}" rationale`,
      issues,
    );
  });

  return { ok: issues.length === 0, issues };
};

// ─── Top-level: run all layers ────────────────────────────────────────────────

export const validateEvidenceContract = (result: OrchestratorResult): ValidationResult => {
  const l1 = validateStructured(result);
  const l3 = validatePostValidator(result);
  // L1 (structured) is authoritative — hallucinated tool_call_id must block.
  // L3 (numeric regex) is heuristic + noisy on free-text narratives (e.g. "49 signals");
  // surface as issues for observability but don't fail the phase. Spec §10.3 allows this.
  return { ok: l1.ok, issues: [...l1.issues, ...l3.issues] };
};

// ─── Retry-prompt builder ─────────────────────────────────────────────────────

/**
 * Returns a prompt fragment the orchestrator can send back to the LLM to fix
 * cite violations in the same phase.
 */
export const buildRetryPrompt = (issues: ValidationIssue[]): string => {
  const lines = issues.map((i) => `- [${i.code}] ${i.message}`);
  return (
    `Your previous output had evidence-cite violations:\n${lines.join("\n")}\n\n` +
    `Please regenerate the output, making sure every numeric claim and factual assertion ` +
    `cites a tool_call_id from the current investigation's tool_calls. ` +
    `Output ONLY the corrected JSON.`
  );
};
