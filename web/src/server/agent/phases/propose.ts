import "server-only";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/anthropic";
import {
  validateEvidenceContract,
  buildRetryPrompt,
} from "@/server/agent/evidence-validator";
import { logTurn, logPhaseStart, logPhaseComplete } from "@/server/agent/session-logger";
import { publishSessionEvent } from "@/lib/event-bus";
import { buildSysPropose } from "./prompts";
import type { ClassifyOutput, IncidentSeed } from "./classify";
import type { InvestigateOutput } from "./investigate";
import type { Draft8D } from "./compose";
import { EvidenceCiteUnfixableError } from "./compose";
import type { OrchestratorResult } from "@/server/agent/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Initiative = OrchestratorResult["initiatives"][number];

// ─── Zod schema ───────────────────────────────────────────────────────────────

const ClosurePredicateSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("no_defect_code_in_window"),
    params: z.object({
      defect_code: z.string(),
      days: z.number().int().positive(),
      product_id: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("manual_confirmation"),
    params: z.object({
      confirmed_by: z.string().optional(),
    }),
  }),
]);

const InitiativeSchema = z.object({
  title: z.string().min(1),
  domain: z.enum(["production", "supplier", "rnd"]),
  target_system: z.string().min(1),
  owner_hint: z.string().min(1),
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).min(1),
  closure_predicate: ClosurePredicateSchema,
});

const InitiativesSchema = z.array(InitiativeSchema).min(1);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stripFences = (text: string): string =>
  text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

export const parseInitiativesOutput = (raw: string): Initiative[] => {
  const cleaned = stripFences(raw);
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error(`parseInitiativesOutput: no JSON array found in: ${raw.slice(0, 200)}`);
  }
  const json = cleaned.slice(start, end + 1);
  const parsed: unknown = JSON.parse(json);
  return InitiativesSchema.parse(parsed) as Initiative[];
};

let _eventSeq = 300;
const nextSeq = () => ++_eventSeq;

// ─── Phase runner ─────────────────────────────────────────────────────────────

export const runPropose = async (
  session_id: string,
  incident: IncidentSeed,
  classified: ClassifyOutput,
  investigated: InvestigateOutput,
  draft8d: Draft8D,
): Promise<Initiative[]> => {
  const client = getAnthropicClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY is not set — cannot run LLM phases.");

  await logPhaseStart(session_id, "propose", {
    incident_id: incident.incident_id,
    archetype: classified.archetype,
  });
  publishSessionEvent(session_id, {
    event_seq: nextSeq(),
    event_type: "phase_start",
    payload: { phase: "propose", archetype: classified.archetype },
    ts: new Date().toISOString(),
  });

  const toolCallSummary = investigated.tool_calls.map((tc) => ({
    tool_call_id: tc.tool_call_id,
    tool: tc.tool,
    summary: tc.summary,
  }));

  const userContent = [
    `Incident ID: ${incident.incident_id}`,
    `Title: ${incident.title ?? "(none)"}`,
    `Archetype: ${classified.archetype}`,
    ``,
    `8D Draft (composed):`,
    JSON.stringify(draft8d, null, 2),
    ``,
    `Investigation tool calls (use these tool_call_ids as evidence citations):`,
    JSON.stringify(toolCallSummary, null, 2),
    ``,
    `Propose 2–3 initiatives. Return a JSON array only.`,
  ].join("\n");

  const sysMsg = buildSysPropose();
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
      payload: { phase: "propose", text: textDelta },
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
    turn_index: 30,
    phase: "propose",
    role: "assistant",
    model: resp.model,
    content_text: text,
    tokens_in: resp.usage.input_tokens,
    tokens_out: resp.usage.output_tokens,
    duration_ms: Date.now() - t0,
  });

  let initiatives = parseInitiativesOutput(text);

  // ─── Evidence-cite validation + one retry ────────────────────────────────

  const buildPartialResult = (inits: Initiative[]): OrchestratorResult => ({
    incident_id: incident.incident_id,
    archetype: classified.archetype,
    tool_calls: investigated.tool_calls,
    draft_8d: draft8d,
    initiatives: inits,
    phases: [],
  });

  let validation = validateEvidenceContract(buildPartialResult(initiatives));

  if (!validation.ok) {
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
        payload: { phase: "propose_retry", text: textDelta },
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
      turn_index: 31,
      phase: "propose",
      role: "assistant",
      model: retryResp.model,
      content_text: retryText,
      tokens_in: retryResp.usage.input_tokens,
      tokens_out: retryResp.usage.output_tokens,
      duration_ms: Date.now() - retryT0,
    });

    initiatives = parseInitiativesOutput(retryText);
    validation = validateEvidenceContract(buildPartialResult(initiatives));

    if (!validation.ok) {
      throw new EvidenceCiteUnfixableError(
        `Evidence contract still failing after retry (propose): ${validation.issues.map((i) => i.code).join(", ")}`,
      );
    }
  }

  await logPhaseComplete(session_id, "propose", {
    initiative_count: initiatives.length,
  });

  publishSessionEvent(session_id, {
    event_seq: nextSeq(),
    event_type: "phase_complete",
    payload: { phase: "propose", initiative_count: initiatives.length },
    ts: new Date().toISOString(),
  });

  return initiatives;
};
