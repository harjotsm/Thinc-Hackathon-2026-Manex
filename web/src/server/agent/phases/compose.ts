import "server-only";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/anthropic";
import {
  validateEvidenceContract,
  buildRetryPrompt,
} from "@/server/agent/evidence-validator";
import { logTurn, logPhaseStart, logPhaseComplete } from "@/server/agent/session-logger";
import { publishSessionEvent } from "@/lib/event-bus";
import { buildSysCompose } from "./prompts";
import type { ClassifyOutput, IncidentSeed } from "./classify";
import type { InvestigateOutput } from "./investigate";
import type { OrchestratorResult } from "@/server/agent/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Draft8D = OrchestratorResult["draft_8d"];

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
): Promise<Draft8D> => {
  const client = getAnthropicClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY is not set — cannot run LLM phases.");

  await logPhaseStart(session_id, "compose", {
    incident_id: incident.incident_id,
    tool_call_count: investigated.tool_calls.length,
  });

  const toolCallSummary = investigated.tool_calls.map((tc) => ({
    tool_call_id: tc.tool_call_id,
    tool: tc.tool,
    summary: tc.summary,
  }));

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
    `Compose the 8D draft. Return JSON only.`,
  ].join("\n");

  const sysMsg = buildSysCompose();
  const t0 = Date.now();

  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: sysMsg,
    messages: [{ role: "user", content: userContent }],
  });

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
    const retryResp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: sysMsg,
      messages: [{ role: "user", content: retryContent }],
    });

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

  await logPhaseComplete(session_id, "compose", {
    evidence_count: draft8d.evidence.length,
    claims_count: draft8d.claims.length,
  });

  publishSessionEvent(session_id, {
    event_seq: nextSeq(),
    event_type: "phase_complete",
    payload: { phase: "compose", evidence_count: draft8d.evidence.length },
    ts: new Date().toISOString(),
  });

  return draft8d;
};
