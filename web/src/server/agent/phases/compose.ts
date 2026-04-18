import "server-only";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import {
  validateEvidenceContract,
  buildRetryPrompt,
} from "@/server/agent/evidence-validator";
import { logTurn, logPhaseStart, logPhaseComplete } from "@/server/agent/session-logger";
import { publishSessionEvent } from "@/lib/event-bus";
import { makeId } from "@/server/utils/id";
import { buildSysCompose } from "./prompts";
import type { ClassifyOutput, IncidentSeed } from "./classify";
import type { InvestigateOutput } from "./investigate";
import type { OrchestratorResult } from "@/server/agent/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Draft8D = OrchestratorResult["draft_8d"];

export type ComposeOutput = {
  draft_8d: Draft8D;
  report_id: string;
};

// ─── Zod schema for the Compose output ───────────────────────────────────────

const ClaimSchema = z.object({
  claim: z.string(),
  evidence: z.array(z.string()).min(1),
});

const Draft8DSchema = z.object({
  problem: z.string().min(1),
  containment: z.array(z.string()).min(1),
  likely_root_causes: z.array(z.string()).min(1),
  evidence: z.array(z.string()).min(1),
  claims: z.array(ClaimSchema).min(1),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stripFences = (text: string): string =>
  text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

export const parseDraft8DOutput = (raw: string): Draft8D => {
  const cleaned = stripFences(raw);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`parseDraft8DOutput: no JSON object found in: ${raw.slice(0, 200)}`);
  }
  const json = cleaned.slice(start, end + 1);
  const parsed: unknown = JSON.parse(json);
  return Draft8DSchema.parse(parsed);
};

// ─── Contribution loader ──────────────────────────────────────────────────────

type ContributionRow = {
  domain: string;
  content: string | null;
  structured_payload: unknown;
  source: string;
  status: string;
};

/** Load contribution rows for this incident (fresh DB read — tools may have just written). */
const loadContributions = async (incident_id: string): Promise<ContributionRow[]> => {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("contribution")
    .select("domain,content,structured_payload,source,status")
    .eq("incident_id", incident_id);

  if (error) {
    // Non-fatal — log and return empty; Compose can still work without contributions
    console.warn(`[compose] loadContributions failed for ${incident_id}: ${error.message}`);
    return [];
  }

  return (data ?? []) as ContributionRow[];
};

/** Format contribution rows as a markdown block for the user message. */
const formatContributions = (rows: ContributionRow[]): string => {
  if (rows.length === 0) {
    return "## Stakeholder Contributions\n\n(none available)";
  }

  const lines = rows.map((r) => {
    const summary =
      r.content
        ? r.content.slice(0, 300).replace(/\n/g, " ")
        : r.structured_payload
          ? JSON.stringify(r.structured_payload).slice(0, 200)
          : "(empty)";
    return `- **${r.domain}** (${r.source}/${r.status}): ${summary}`;
  });

  return ["## Stakeholder Contributions", "", ...lines].join("\n");
};

// Error tag for evidence-cite failures
export class EvidenceCiteUnfixableError extends Error {
  readonly isEvidenceCiteUnfixable = true;
  constructor(message: string) {
    super(message);
    this.name = "EvidenceCiteUnfixableError";
  }
}

let _eventSeq = 200;
const nextSeq = () => ++_eventSeq;

// ─── Phase runner ─────────────────────────────────────────────────────────────

export const runCompose = async (
  session_id: string,
  incident: IncidentSeed,
  classified: ClassifyOutput,
  investigated: InvestigateOutput,
): Promise<ComposeOutput> => {
  const client = getAnthropicClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY is not set — cannot run LLM phases.");

  await logPhaseStart(session_id, "compose", {
    incident_id: incident.incident_id,
    tool_call_count: investigated.tool_calls.length,
  });
  publishSessionEvent(session_id, {
    event_seq: nextSeq(),
    event_type: "phase_start",
    payload: { phase: "compose", tool_call_count: investigated.tool_calls.length },
    ts: new Date().toISOString(),
  });

  const toolCallSummary = investigated.tool_calls.map((tc) => ({
    tool_call_id: tc.tool_call_id,
    tool: tc.tool,
    summary: tc.summary,
  }));

  // Load contributions (fresh read — contribution tools ran during Classify)
  const contributions = await loadContributions(incident.incident_id);
  const contributionBlock = formatContributions(contributions);

  const userContent = [
    `Incident ID: ${incident.incident_id}`,
    `Title: ${incident.title ?? "(none)"}`,
    `Summary: ${incident.summary ?? "(none)"}`,
    `Archetype: ${classified.archetype}`,
    `Signature: ${classified.signature_text}`,
    ``,
    `Investigation narrative:`,
    investigated.final_narrative,
    ``,
    `Tool call results (use these tool_call_ids as evidence citations):`,
    JSON.stringify(toolCallSummary, null, 2),
    ``,
    contributionBlock,
    ``,
    `Compose the 8D draft. Return JSON only.`,
  ].join("\n");

  const sysMsg = buildSysCompose();
  const t0 = Date.now();

  // Stream the Sonnet call so we can emit token_delta events live (not persisted).
  const streamHandle = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: sysMsg,
    messages: [{ role: "user", content: userContent }],
  });

  streamHandle.on("text", (textDelta: string) => {
    publishSessionEvent(session_id, {
      event_seq: 0, // ephemeral — not persisted (spec §6.3)
      event_type: "token_delta",
      payload: { phase: "compose", text: textDelta },
      ts: new Date().toISOString(),
    });
  });

  const resp = await streamHandle.finalMessage();

  const text = resp.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();

  await logTurn({
    session_id,
    turn_index: 0,
    phase: "compose",
    role: "assistant",
    model: resp.model,
    content_text: text,
    tokens_in: resp.usage.input_tokens,
    tokens_out: resp.usage.output_tokens,
    duration_ms: Date.now() - t0,
  });

  let draft8d = parseDraft8DOutput(text);

  // ─── Evidence-cite validation + one retry ────────────────────────────────

  // Build a partial OrchestratorResult to run the validator
  const buildPartialResult = (d: Draft8D): OrchestratorResult => ({
    incident_id: incident.incident_id,
    archetype: classified.archetype,
    tool_calls: investigated.tool_calls,
    draft_8d: d,
    initiatives: [],
    phases: [],
  });

  let validation = validateEvidenceContract(buildPartialResult(draft8d));

  if (!validation.ok) {
    // Retry once with the retry prompt
    const retryContent = [
      userContent,
      ``,
      buildRetryPrompt(validation.issues),
    ].join("\n");

    const retryT0 = Date.now();
    const retryStreamHandle = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: sysMsg,
      messages: [{ role: "user", content: retryContent }],
    });

    retryStreamHandle.on("text", (textDelta: string) => {
      publishSessionEvent(session_id, {
        event_seq: 0,
        event_type: "token_delta",
        payload: { phase: "compose_retry", text: textDelta },
        ts: new Date().toISOString(),
      });
    });

    const retryResp = await retryStreamHandle.finalMessage();

    const retryText = retryResp.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();

    await logTurn({
      session_id,
      turn_index: 1,
      phase: "compose",
      role: "assistant",
      model: retryResp.model,
      content_text: retryText,
      tokens_in: retryResp.usage.input_tokens,
      tokens_out: retryResp.usage.output_tokens,
      duration_ms: Date.now() - retryT0,
    });

    draft8d = parseDraft8DOutput(retryText);
    validation = validateEvidenceContract(buildPartialResult(draft8d));

    if (!validation.ok) {
      throw new EvidenceCiteUnfixableError(
        `Evidence contract still failing after retry: ${validation.issues.map((i) => i.code).join(", ")}`,
      );
    }
  }

  // ─── Persist report to DB ────────────────────────────────────────────────

  const supabase = getSupabaseServerClient();
  const reportId = makeId("RPT");
  const confidence = Math.min(
    0.95,
    0.5 + draft8d.claims.length * 0.05 + draft8d.evidence.length * 0.02,
  );

  const reportRow = {
    id: reportId,
    incident_id: incident.incident_id,
    session_id,
    version: 1,
    status: "current" as const,
    report_8d: draft8d as unknown as Record<string, unknown>,
    composed_by_model: resp.model,
    composed_at: new Date().toISOString(),
    confidence,
    compose_tokens_in: resp.usage.input_tokens,
    compose_tokens_out: resp.usage.output_tokens,
  };

  const { error: insertError } = await supabase.from("report").insert(reportRow);

  if (insertError) {
    // Unique partial index violation: a 'current' report already exists for this incident
    if (
      insertError.code === "23505" ||
      insertError.message?.includes("report_one_current_per_incident") ||
      insertError.message?.toLowerCase().includes("unique")
    ) {
      // Supersede the existing current report
      await supabase
        .from("report")
        .update({ status: "superseded" })
        .eq("incident_id", incident.incident_id)
        .eq("status", "current");

      // Determine next version number
      const { data: maxRow } = await supabase
        .from("report")
        .select("version")
        .eq("incident_id", incident.incident_id)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const nextVersion = ((maxRow as { version: number } | null)?.version ?? 1) + 1;

      const { error: retryError } = await supabase.from("report").insert({
        ...reportRow,
        version: nextVersion,
      });

      if (retryError) {
        console.error(`[compose] report re-insert failed: ${retryError.message}`);
      }
    } else {
      console.error(`[compose] report insert failed: ${insertError.message}`);
    }
  }

  await logPhaseComplete(session_id, "compose", {
    evidence_count: draft8d.evidence.length,
    claims_count: draft8d.claims.length,
    report_id: reportId,
  });

  publishSessionEvent(session_id, {
    event_seq: nextSeq(),
    event_type: "phase_complete",
    payload: { phase: "compose", evidence_count: draft8d.evidence.length, report_id: reportId },
    ts: new Date().toISOString(),
  });

  return { draft_8d: draft8d, report_id: reportId };
};
