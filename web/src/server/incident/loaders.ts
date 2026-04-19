import "server-only";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// ─── Types ────────────────────────────────────────────────────────────────────
//
// The shapes here are tuned to what the orchestrator actually writes into the
// `report.report_8d` JSON column (see web/src/server/agent/phases/compose.ts
// and orchestrator.ts). The contract is:
//
//   draft_8d   = { problem, containment[], likely_root_causes[], evidence[], claims[] }
//   _archetype = "supplier" | "drift" | "design" | "operator" | "unknown"
//   _initiatives = Initiative[]                  (added by Propose phase)
//   _tool_calls  = ToolCallResult[]              (added by orchestrator)
//
// The /api/incident/[incidentId]/report route splits these out before
// returning, but for server-side loading we go straight to the DB so we don't
// pay an internal HTTP roundtrip. The fields below mirror that route's shape.
// ─────────────────────────────────────────────────────────────────────────────

export type IncidentRow = {
  incident_id: string;
  title: string | null;
  summary: string | null;
  severity: "low" | "medium" | "high" | "critical" | string | null;
  primary_product_id: string | null;
  status: string | null;
};

export type SignalRow = {
  signal_id: string;
  signal_type: string | null;
  source_system: string | null;
  captured_ts: string | null;
  text_payload: string | null;
};

export type ContributionRow = {
  contribution_id: string;
  domain: string;
  content: string | null;
  structured_payload: unknown;
  source: string | null;
  status: string | null;
  weight: number | null;
  created_ts: string | null;
};

// ─── report_8d Zod schema (parses the actual stored JSON) ────────────────────

const ClaimSchema = z.object({
  claim: z.string(),
  evidence: z.array(z.string()),
});
export type Claim = z.infer<typeof ClaimSchema>;

const InitiativeSchema = z.object({
  title: z.string(),
  domain: z.string(),
  target_system: z.string(),
  owner_hint: z.string(),
  rationale: z.string(),
  confidence: z.number(),
  evidence: z.array(z.string()),
  closure_predicate: z
    .object({
      type: z.string(),
      params: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});
export type ReportInitiative = z.infer<typeof InitiativeSchema>;

const ToolCallSchema = z.object({
  tool_call_id: z.string(),
  tool: z.string(),
  summary: z.string().optional().default(""),
  data: z.unknown().optional(),
});
export type ReportToolCall = z.infer<typeof ToolCallSchema>;

// The actual draft8D produced by Compose (NOT the spec'd D1-D8 shape).
const Draft8DSchema = z.object({
  problem: z.string().min(1),
  containment: z.array(z.string()),
  likely_root_causes: z.array(z.string()),
  evidence: z.array(z.string()),
  claims: z.array(ClaimSchema),
});
export type Draft8D = z.infer<typeof Draft8DSchema>;

const ReportArchetypeSchema = z
  .enum(["supplier", "drift", "design", "operator", "unknown"])
  .nullable();
export type ReportArchetype = z.infer<typeof ReportArchetypeSchema>;

export type ReportBundle = {
  report_id: string;
  version: number;
  composed_at: string | null;
  composed_by_model: string | null;
  confidence: number | null;
  draft_8d: Draft8D;
  archetype: ReportArchetype;
  initiatives: ReportInitiative[];
  tool_calls: ReportToolCall[];
};

export type IncidentBundle = {
  incident: IncidentRow | null;
  signals: SignalRow[];
  contributions: ContributionRow[];
  report: ReportBundle | null;
  /**
   * Aggregated user-facing reason for `report === null` so the UI doesn't have
   * to reason about it. Possible values:
   *   - "no-incident"            → incident row missing
   *   - "orchestrator-pending"   → no current report yet
   *   - "report-malformed"       → row exists but report_8d JSON is bad
   *   - null                     → report present
   */
  reportMissingReason:
    | "no-incident"
    | "orchestrator-pending"
    | "report-malformed"
    | null;
};

// ─── Internal: report parser ─────────────────────────────────────────────────

const parseReportRow = (row: {
  id: string;
  version: number;
  composed_at: string | null;
  composed_by_model: string | null;
  confidence: number | null;
  report_8d: unknown;
}): ReportBundle | { malformed: true; reason: string } => {
  const raw = (row.report_8d ?? {}) as Record<string, unknown>;

  const { _initiatives, _tool_calls, _archetype, ...draftCandidate } = raw;

  const draftParsed = Draft8DSchema.safeParse(draftCandidate);
  if (!draftParsed.success) {
    return {
      malformed: true,
      reason: draftParsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    };
  }

  // Initiatives: best-effort parse, drop entries that don't fit.
  const initiatives: ReportInitiative[] = Array.isArray(_initiatives)
    ? (_initiatives as unknown[])
        .map((i) => InitiativeSchema.safeParse(i))
        .filter((p) => p.success)
        .map((p) => (p as { success: true; data: ReportInitiative }).data)
    : [];

  const toolCalls: ReportToolCall[] = Array.isArray(_tool_calls)
    ? (_tool_calls as unknown[])
        .map((t) => ToolCallSchema.safeParse(t))
        .filter((p) => p.success)
        .map((p) => (p as { success: true; data: ReportToolCall }).data)
    : [];

  const archetypeParsed = ReportArchetypeSchema.safeParse(_archetype ?? null);
  const archetype = archetypeParsed.success ? archetypeParsed.data : null;

  return {
    report_id: row.id,
    version: row.version,
    composed_at: row.composed_at,
    composed_by_model: row.composed_by_model,
    confidence: row.confidence,
    draft_8d: draftParsed.data,
    archetype,
    initiatives,
    tool_calls: toolCalls,
  };
};

// ─── Public: getIncidentBundle ───────────────────────────────────────────────

export const getIncidentBundle = async (
  incidentId: string,
): Promise<IncidentBundle> => {
  const supabase = getSupabaseServerClient();

  // Run all four reads in parallel. Errors on individual queries degrade
  // gracefully to empty data (with a logged warning) so the page can still
  // render against partial data.
  const [incidentRes, signalLinkRes, contribRes, reportRes] = await Promise.all([
    supabase
      .from("incident")
      .select("incident_id,title,summary,severity,primary_product_id,status")
      .eq("incident_id", incidentId)
      .maybeSingle(),
    supabase
      .from("incident_signal")
      .select("signal_id")
      .eq("incident_id", incidentId),
    supabase
      .from("contribution")
      .select(
        "contribution_id,domain,content,structured_payload,source,status,weight,created_ts",
      )
      .eq("incident_id", incidentId)
      .order("created_ts", { ascending: true }),
    supabase
      .from("report")
      .select(
        "id,incident_id,version,status,report_8d,composed_by_model,composed_at,confidence,session_id",
      )
      .eq("incident_id", incidentId)
      .eq("status", "current")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Resolve signals via second hop (we only have the link rows so far).
  const signalIds = ((signalLinkRes.data ?? []) as { signal_id: string }[]).map(
    (r) => r.signal_id,
  );
  let signals: SignalRow[] = [];
  if (signalIds.length > 0) {
    const { data: sigData, error: sigErr } = await supabase
      .from("signal")
      .select("signal_id,signal_type,source_system,captured_ts,text_payload")
      .in("signal_id", signalIds)
      .order("captured_ts", { ascending: false });
    if (!sigErr && sigData) {
      signals = sigData as SignalRow[];
    } else if (sigErr) {
      console.warn(
        `[incident-loader] signals fetch failed for ${incidentId}: ${sigErr.message}`,
      );
    }
  }

  const incident = (incidentRes.data ?? null) as IncidentRow | null;
  const contributions = ((contribRes.data ?? []) as ContributionRow[]) || [];

  let report: ReportBundle | null = null;
  let reportMissingReason: IncidentBundle["reportMissingReason"] = null;

  if (!incident) {
    reportMissingReason = "no-incident";
  } else if (!reportRes.data) {
    reportMissingReason = "orchestrator-pending";
  } else {
    const parsed = parseReportRow(
      reportRes.data as Parameters<typeof parseReportRow>[0],
    );
    if ("malformed" in parsed) {
      reportMissingReason = "report-malformed";
      console.warn(
        `[incident-loader] malformed report for ${incidentId}: ${parsed.reason}`,
      );
    } else {
      report = parsed;
    }
  }

  return { incident, signals, contributions, report, reportMissingReason };
};

// ─── Hypothesis derivation ────────────────────────────────────────────────────
//
// "Hypothesis" in the UI maps to one entry in `draft_8d.likely_root_causes`,
// projected with a synthesized confidence + supporting evidence.
//
// The orchestrator stores root causes as plain strings, not as a structured
// tree, so we synthesize confidence from claim/evidence overlap:
//   - For each root cause, count claims whose `claim` text mentions any
//     significant word from the root cause string (3+ chars). That's the
//     "supporting" count.
//   - Confidence = base 0.40 + 0.10 × supportingClaims, capped at 0.92, with
//     the first (primary) root cause getting a +0.10 nudge to reflect that
//     orchestrator typically lists most-likely first.
//   - Conflicting count is heuristic and currently 0 — there's no signal in
//     the stored data that flags conflicting evidence.

export type HypothesisView = {
  id: string;
  rank: number;
  title: string;
  oneLiner: string;
  confidence: number; // 0..1
  supportingEvidence: string[];
  conflictingEvidence: string[]; // currently always [] — see note above
  archetypeHint: string | null; // best-guess label for chip ("Supplier" etc.)
  isPrimary: boolean;
};

const ARCHETYPE_KEYWORDS: Array<{ key: string; matches: RegExp }> = [
  { key: "Supplier", matches: /\b(supplier|batch|sb-|esr|incoming|inbound|elektroparts)\b/i },
  { key: "Process", matches: /\b(spc|drift|calibration|reflow|process|line|station|stn-)\b/i },
  { key: "Design", matches: /\b(design|thermal|footprint|tolerance|spec|r33|mc-)\b/i },
  { key: "Operator", matches: /\b(operator|handling|user_|manual|training|skill)\b/i },
];

const guessArchetype = (text: string): string | null => {
  for (const { key, matches } of ARCHETYPE_KEYWORDS) {
    if (matches.test(text)) return key;
  }
  return null;
};

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);

export const deriveHypotheses = (report: ReportBundle): HypothesisView[] => {
  const causes = report.draft_8d.likely_root_causes;
  if (causes.length === 0) return [];

  return causes.map((cause, idx) => {
    const causeTokens = new Set(tokenize(cause));
    const supporting: string[] = [];
    for (const claim of report.draft_8d.claims) {
      const claimTokens = tokenize(claim.claim);
      const overlap = claimTokens.some((t) => causeTokens.has(t));
      if (overlap) {
        for (const ev of claim.evidence) {
          if (!supporting.includes(ev)) supporting.push(ev);
        }
      }
    }
    // Fall back to top-level evidence list if claim-overlap matched nothing.
    if (supporting.length === 0 && idx === 0) {
      supporting.push(...report.draft_8d.evidence.slice(0, 5));
    }

    const baseConf = idx === 0 ? 0.5 : 0.35;
    const confidence = Math.min(
      0.92,
      baseConf + supporting.length * 0.08,
    );

    const oneLine = cause.length > 140 ? `${cause.slice(0, 137)}...` : cause;

    return {
      id: `HYP-${idx + 1}`,
      rank: idx + 1,
      title: cause.split(/[.;:]/)[0]?.trim() ?? cause,
      oneLiner: oneLine,
      confidence,
      supportingEvidence: supporting,
      conflictingEvidence: [],
      archetypeHint: guessArchetype(cause) ?? guessArchetype(report.draft_8d.problem),
      isPrimary: idx === 0,
    };
  });
};
