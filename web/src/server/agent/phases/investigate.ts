import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic";
import { nonWriteTools, invokeTool } from "@/server/tools/registry";
import "@/server/tools/_register"; // side-effect registrations
import { logTurn, logPhaseStart, logPhaseComplete } from "@/server/agent/session-logger";
import { publishSessionEvent } from "@/lib/event-bus";
import { buildSysInvestigate } from "./prompts";
import type { ClassifyOutput, IncidentSeed, LessonPrior } from "./classify";
import type { ToolCallResult } from "@/server/agent/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_TURNS = 8;
// Phase-scoped turn_index offset — avoids collision with the assistant unique constraint
// session_turn_one_assistant_per_turn: UNIQUE (session_id, turn_index) WHERE role='assistant'.
// Classify uses 0..4; Investigate starts at 10.
const PHASE_TURN_OFFSET = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvestigateOutput = {
  tool_calls: ToolCallResult[];
  final_narrative: string;
};

// ─── Zod → Anthropic Tool conversion ─────────────────────────────────────────

/**
 * Convert a registered ToolSpec's Zod input_schema to the Anthropic Tool format.
 * Zod 4.x has built-in z.toJSONSchema() — we use it and cast to the Anthropic shape.
 */
const buildAnthropicTools = (): Anthropic.Messages.Tool[] => {
  const specs = nonWriteTools();
  return specs.map((spec) => {
    // z.toJSONSchema returns a JSON Schema object; Anthropic needs { type: 'object', ... }
    const jsonSchema = z.toJSONSchema(spec.input_schema) as Record<string, unknown>;

    // Strip $schema meta-field — Anthropic doesn't need it and it's noise
    const { $schema: _$schema, ...inputSchema } = jsonSchema;

    // Ensure type is 'object' — Anthropic's InputSchema requires it
    const safeSchema: Anthropic.Messages.Tool.InputSchema = {
      type: "object",
      ...inputSchema,
    };

    return {
      name: spec.name,
      description: spec.description,
      input_schema: safeSchema,
    };
  });
};

// ─── Event seq counter (module-level, per-process) ───────────────────────────

let _eventSeq = 100; // offset from classify's counter to avoid collisions
const nextSeq = () => ++_eventSeq;

// ─── Phase runner ─────────────────────────────────────────────────────────────

export const runInvestigate = async (
  session_id: string,
  incident: IncidentSeed,
  classified: ClassifyOutput,
): Promise<InvestigateOutput> => {
  const client = getAnthropicClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY is not set — cannot run LLM phases.");

  await logPhaseStart(session_id, "investigate", {
    incident_id: incident.incident_id,
    archetype: classified.archetype,
  });
  publishSessionEvent(session_id, {
    event_seq: nextSeq(),
    event_type: "phase_start",
    payload: { phase: "investigate", archetype: classified.archetype },
    ts: new Date().toISOString(),
  });

  const toolList = buildAnthropicTools();
  const allToolCalls: ToolCallResult[] = [];

  // Build system prompt with optional lesson priors (5b.3)
  const lessons: LessonPrior[] = classified.lessons_retrieved ?? [];
  const systemMsg = buildSysInvestigate(lessons);
  const initialUserContent = [
    `Incident ID: ${incident.incident_id}`,
    `Title: ${incident.title ?? "(none)"}`,
    `Summary: ${incident.summary ?? "(none)"}`,
    `Primary product: ${incident.primary_product_id ?? "(none)"}`,
    `Primary part: ${incident.primary_part ?? "(none)"}`,
    ``,
    `Archetype: ${classified.archetype}`,
    `Signature: ${classified.signature_text}`,
    ``,
    `Initial hypotheses:`,
    classified.initial_hypotheses.map((h, i) => `${i + 1}. ${h}`).join("\n"),
    ``,
    `Investigate thoroughly. Use tools to gather evidence, then produce a final narrative summary.`,
  ].join("\n");

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: initialUserContent },
  ];

  let finalNarrative = "";
  let t0 = Date.now();

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    t0 = Date.now();

    // Use streaming API so we can emit token_delta events live.
    // finalMessage() gives us the complete Message (content blocks + usage) once done.
    const streamHandle = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemMsg,
      tools: toolList,
      messages,
    });

    // Emit token_delta for each text chunk — NOT persisted (spec §6.3)
    streamHandle.on("text", (textDelta: string) => {
      publishSessionEvent(session_id, {
        event_seq: 0, // ephemeral — not persisted
        event_type: "token_delta",
        payload: { phase: "investigate", text: textDelta },
        ts: new Date().toISOString(),
      });
    });

    const resp = await streamHandle.finalMessage();

    const assistantContent = resp.content;
    messages.push({ role: "assistant", content: assistantContent });

    // Extract text from this assistant turn (for logging)
    const assistantText = assistantContent
      .filter((c): c is Anthropic.Messages.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();

    await logTurn({
      session_id,
      turn_index: PHASE_TURN_OFFSET + turn,
      phase: "investigate",
      role: "assistant",
      model: resp.model,
      content_text: assistantText || undefined,
      tokens_in: resp.usage.input_tokens,
      tokens_out: resp.usage.output_tokens,
      duration_ms: Date.now() - t0,
    });

    // If no tool uses → model is done investigating
    const toolUses = assistantContent.filter(
      (c): c is Anthropic.Messages.ToolUseBlock => c.type === "tool_use",
    );

    if (toolUses.length === 0 || resp.stop_reason === "end_turn") {
      // The last assistant text is the final narrative
      finalNarrative = assistantText;
      break;
    }

    // Invoke each tool and collect results
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const tu of toolUses) {
      try {
        const result = await invokeTool(tu.name, tu.input, {
          session_id,
          incident_id: incident.incident_id,
        });

        allToolCalls.push(result);

        await logTurn({
          session_id,
          turn_index: PHASE_TURN_OFFSET + turn,
          phase: "investigate",
          role: "tool",
          tool_call: {
            tool_call_id: result.tool_call_id,
            tool_use_id: tu.id,
            name: tu.name,
            input: tu.input,
            output_summary: result.summary,
          },
          duration_ms: Date.now() - t0,
        });

        publishSessionEvent(session_id, {
          event_seq: nextSeq(),
          event_type: "tool_result",
          payload: {
            tool_call_id: result.tool_call_id,
            tool: tu.name,
            summary: result.summary,
          },
          ts: new Date().toISOString(),
        });

        const resultPayload = JSON.stringify({
          tool_call_id: result.tool_call_id,
          summary: result.summary,
          data: result.data,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          // Cap size to avoid oversized context (20k chars ~= 5k tokens)
          content: resultPayload.slice(0, 20_000),
        });
      } catch (err) {
        const errMsg = `Tool error: ${(err as Error).message}`;

        await logTurn({
          session_id,
          turn_index: PHASE_TURN_OFFSET + turn,
          phase: "investigate",
          role: "tool",
          tool_call: {
            tool_use_id: tu.id,
            name: tu.name,
            input: tu.input,
            error: errMsg,
          },
          duration_ms: Date.now() - t0,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: errMsg,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  // If we hit MAX_TURNS without end_turn, use whatever text the model produced last
  if (!finalNarrative) {
    const lastAssistantMsg = messages
      .filter((m) => m.role === "assistant")
      .pop();
    if (lastAssistantMsg && Array.isArray(lastAssistantMsg.content)) {
      finalNarrative = (lastAssistantMsg.content as Anthropic.Messages.ContentBlock[])
        .filter((c): c is Anthropic.Messages.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim();
    }
    if (!finalNarrative) {
      finalNarrative = `Investigation completed with ${allToolCalls.length} tool calls.`;
    }
  }

  await logPhaseComplete(session_id, "investigate", {
    tool_call_count: allToolCalls.length,
  });

  publishSessionEvent(session_id, {
    event_seq: nextSeq(),
    event_type: "phase_complete",
    payload: { phase: "investigate", tool_call_count: allToolCalls.length },
    ts: new Date().toISOString(),
  });

  return { tool_calls: allToolCalls, final_narrative: finalNarrative };
};
