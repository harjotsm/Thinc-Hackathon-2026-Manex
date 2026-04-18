import "server-only";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { logTurn, logPhaseStart, logPhaseComplete } from "@/server/agent/session-logger";
import { publishSessionEvent } from "@/lib/event-bus";
import { buildSysClassify } from "./prompts";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IncidentSeed = {
  incident_id: string;
  title: string | null;
  summary: string | null;
  primary_product_id: string | null;
  primary_part: string | null;
};

const ClassifyOutputSchema = z.object({
  archetype: z.enum(["supplier", "drift", "design", "operator", "unknown"]),
  signature_text: z.string().min(1),
  initial_hypotheses: z.array(z.string()).min(1).max(5),
  confidence: z.number().min(0).max(1),
});

export type ClassifyOutput = z.infer<typeof ClassifyOutputSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip markdown code fences and leading/trailing whitespace before parsing. */
const stripFences = (text: string): string =>
  text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

export const parseClassifyOutput = (raw: string): ClassifyOutput => {
  const cleaned = stripFences(raw);
  // Find first { and last } to be robust against trailing noise
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`parseClassifyOutput: no JSON object found in: ${raw.slice(0, 200)}`);
  }
  const json = cleaned.slice(start, end + 1);
  const parsed: unknown = JSON.parse(json);
  return ClassifyOutputSchema.parse(parsed);
};

// ─── requireAnthropicClient ───────────────────────────────────────────────────

export const requireAnthropicClient = () => {
  const client = getAnthropicClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY is not set — cannot run LLM phases.");
  return client;
};

// ─── Phase runner ─────────────────────────────────────────────────────────────

let _eventSeq = 0;
const nextSeq = () => ++_eventSeq;

export const runClassify = async (
  session_id: string,
  incident: IncidentSeed,
): Promise<ClassifyOutput> => {
  const client = requireAnthropicClient();
  await logPhaseStart(session_id, "classify", { incident_id: incident.incident_id });
  const t0 = Date.now();

  const userContent = [
    `Incident to classify:`,
    ``,
    `Title: ${incident.title ?? "(none)"}`,
    `Summary: ${incident.summary ?? "(none)"}`,
    `Primary product: ${incident.primary_product_id ?? "(none)"}`,
    `Primary part: ${incident.primary_part ?? "(none)"}`,
    ``,
    `Return JSON only matching this shape:`,
    `{ "archetype": "supplier|drift|design|operator|unknown", "signature_text": "one-sentence canonical", "initial_hypotheses": ["...", "..."], "confidence": 0.75 }`,
  ].join("\n");

  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: buildSysClassify(),
    messages: [{ role: "user", content: userContent }],
  });

  const text = resp.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();

  const parsed = parseClassifyOutput(text);

  await logTurn({
    session_id,
    turn_index: 0,
    phase: "classify",
    role: "assistant",
    model: resp.model,
    content_text: text,
    tokens_in: resp.usage.input_tokens,
    tokens_out: resp.usage.output_tokens,
    duration_ms: Date.now() - t0,
  });

  await logPhaseComplete(session_id, "classify", {
    archetype: parsed.archetype,
    signature_text: parsed.signature_text,
  });

  publishSessionEvent(session_id, {
    event_seq: nextSeq(),
    event_type: "phase_complete",
    payload: { phase: "classify", archetype: parsed.archetype },
    ts: new Date().toISOString(),
  });

  return parsed;
};
