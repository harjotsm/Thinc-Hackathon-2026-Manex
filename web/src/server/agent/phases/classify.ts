import "server-only";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { invokeTool } from "@/server/tools/registry";
import "@/server/tools/_register"; // side-effect registrations
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
  signal_samples?: string[]; // up to 8 short text excerpts from linked signals
};

const ClassifyOutputSchema = z.object({
  archetype: z.enum(["supplier", "drift", "design", "operator", "unknown"]),
  signature_text: z.string().min(1),
  initial_hypotheses: z.array(z.string()).min(1).max(5),
  confidence: z.number().min(0).max(1),
});

// Extended output includes lessons_retrieved (optional; downstream may ignore)
export type ClassifyOutput = z.infer<typeof ClassifyOutputSchema> & {
  lessons_retrieved?: LessonPrior[];
};

export type LessonPrior = {
  lesson_id: string;
  title?: string;
  prompt_snippet?: string | null;
  signature_text: string;
  archetype?: string | null;
  cosine?: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip markdown code fences and leading/trailing whitespace before parsing. */
const stripFences = (text: string): string =>
  text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

export const parseClassifyOutput = (raw: string): z.infer<typeof ClassifyOutputSchema> => {
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
  publishSessionEvent(session_id, {
    event_seq: nextSeq(),
    event_type: "phase_start",
    payload: { phase: "classify", incident_id: incident.incident_id },
    ts: new Date().toISOString(),
  });
  const t0 = Date.now();

  let userContent = [
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

  if (incident.signal_samples && incident.signal_samples.length > 0) {
    userContent +=
      `\n\nRecent signals (sampled):\n` +
      incident.signal_samples.map((s, i) => `${i + 1}. ${s.slice(0, 280)}`).join("\n");
  }

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

  // ─── Retrieve prior lessons (5b.2) ──────────────────────────────────────────
  // Lower min_cosine than default (0.75) because demo lesson signatures may not
  // perfectly match the Haiku-generated signature_text.
  let lessonsRetrieved: LessonPrior[] = [];
  const lessonTurnIndex = 1;

  try {
    const lessonResult = await invokeTool(
      "retrieve_lessons",
      { query_text: parsed.signature_text, top_k: 3, min_cosine: 0.55 },
      { session_id, incident_id: incident.incident_id },
    );
    lessonsRetrieved = Array.isArray(lessonResult.data)
      ? (lessonResult.data as LessonPrior[])
      : [];

    await logTurn({
      session_id,
      turn_index: lessonTurnIndex,
      phase: "classify",
      role: "tool",
      tool_call: {
        tool_call_id: lessonResult.tool_call_id,
        name: "retrieve_lessons",
        input: { query_text: parsed.signature_text, top_k: 3, min_cosine: 0.55 },
        output_summary: lessonResult.summary,
      },
      duration_ms: Date.now() - t0,
    });
  } catch (err) {
    // Non-fatal — lessons are a nice-to-have for the investigate phase
    console.warn(`[classify ${session_id}] retrieve_lessons failed:`, (err as Error).message);
  }

  // ─── Parallel contribution tool calls (5b.4) ────────────────────────────────
  // Fire all 3 in parallel; each upserts its own contribution row.
  const contribTools = [
    "contrib_central_quality",
    "contrib_plant_quality",
    "contrib_supplier_quality",
  ] as const;

  const contribResults = await Promise.allSettled(
    contribTools.map((name) =>
      invokeTool(
        name,
        { incident_id: incident.incident_id },
        { session_id, incident_id: incident.incident_id },
      ),
    ),
  );

  // Log each contribution tool result as a turn
  for (let i = 0; i < contribTools.length; i++) {
    const toolName = contribTools[i];
    const outcome = contribResults[i];
    const turnIdx = lessonTurnIndex + 1 + i; // turns 2, 3, 4

    if (outcome.status === "fulfilled") {
      await logTurn({
        session_id,
        turn_index: turnIdx,
        phase: "classify",
        role: "tool",
        tool_call: {
          tool_call_id: outcome.value.tool_call_id,
          name: toolName,
          input: { incident_id: incident.incident_id },
          output_summary: outcome.value.summary,
        },
        duration_ms: Date.now() - t0,
      }).catch((logErr) => {
        console.warn(`[classify ${session_id}] logTurn for ${toolName} failed:`, logErr);
      });
    } else {
      // Log failure turn
      console.warn(
        `[classify ${session_id}] ${toolName} rejected:`,
        outcome.reason,
      );
      await logTurn({
        session_id,
        turn_index: turnIdx,
        phase: "classify",
        role: "tool",
        tool_call: {
          name: toolName,
          input: { incident_id: incident.incident_id },
          error: (outcome.reason as Error)?.message ?? String(outcome.reason),
        },
        duration_ms: Date.now() - t0,
      }).catch((logErr) => {
        console.warn(`[classify ${session_id}] logTurn (failure) for ${toolName} failed:`, logErr);
      });
    }
  }

  await logPhaseComplete(session_id, "classify", {
    archetype: parsed.archetype,
    signature_text: parsed.signature_text,
    lessons_retrieved: lessonsRetrieved.length,
  });

  publishSessionEvent(session_id, {
    event_seq: nextSeq(),
    event_type: "phase_complete",
    payload: {
      phase: "classify",
      archetype: parsed.archetype,
      lessons_retrieved: lessonsRetrieved.length,
    },
    ts: new Date().toISOString(),
  });

  return { ...parsed, lessons_retrieved: lessonsRetrieved };
};
