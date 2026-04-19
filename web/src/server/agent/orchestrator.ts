import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { logEvent, updateSessionStatus } from "@/server/agent/session-logger";
import { publishSessionEvent } from "@/lib/event-bus";
import { runClassify } from "@/server/agent/phases/classify";
import { runInvestigate } from "@/server/agent/phases/investigate";
import { runCompose, EvidenceCiteUnfixableError, type ComposeOutput } from "@/server/agent/phases/compose";
import { runPropose } from "@/server/agent/phases/propose";
import type { OrchestratorResult } from "@/server/agent/types";
import type { IncidentSeed } from "@/server/agent/phases/classify";

// ─── Error helpers ────────────────────────────────────────────────────────────

const isEvidenceCiteUnfixable = (err: unknown): boolean =>
  err instanceof EvidenceCiteUnfixableError ||
  (err instanceof Error && err.message.includes("evidence_cite_unfixable"));

const isMaxTurnsError = (err: unknown): boolean =>
  err instanceof Error && err.message.toLowerCase().includes("max_turns");

const isApiError = (err: unknown): boolean =>
  err instanceof Error &&
  (err.message.includes("ANTHROPIC") ||
    err.message.includes("rate_limit") ||
    err.message.includes("overloaded") ||
    err.message.includes("APIError"));

// ─── Session creation helper ──────────────────────────────────────────────────

const createSession = async (
  incidentId: string,
  meta: Record<string, unknown> = {},
): Promise<string> => {
  const supabase = getSupabaseServerClient();
  const sessionId = makeId("SES");
  const now = new Date().toISOString();
  const { error } = await supabase.from("session").insert({
    id: sessionId,
    incident_id: incidentId,
    phase: "classify",
    status: "running",
    started_at: now,
    created_by_user_id: (meta.demo === true ? "system_demo" : null),
  });
  if (error) throw new Error(`createSession failed: ${error.message}`);
  return sessionId;
};

// ─── Incident loader ──────────────────────────────────────────────────────────

const loadIncidentSeed = async (incidentId: string): Promise<IncidentSeed> => {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("incident")
    .select("incident_id,title,summary,primary_product_id,primary_part")
    .eq("incident_id", incidentId)
    .single();

  if (error || !data) {
    throw new Error(`Incident not found: ${error?.message ?? incidentId}`);
  }

  // Pull up to 8 signal text samples for richer classification.
  // Two-hop join mirrors the pattern in web/src/server/incident/loaders.ts.
  const linkRes = await supabase
    .from("incident_signal")
    .select("signal_id")
    .eq("incident_id", incidentId)
    .limit(20);

  const signalIds = ((linkRes.data ?? []) as { signal_id: string }[]).map(
    (r) => r.signal_id,
  );

  let signalSamples: string[] = [];
  if (signalIds.length > 0) {
    const sigRes = await supabase
      .from("signal")
      .select("signal_id,raw_text,text_payload")
      .in("signal_id", signalIds)
      .limit(8);

    signalSamples = ((sigRes.data ?? []) as { raw_text: string | null; text_payload: string | null }[])
      .map((s) => (s.raw_text ?? s.text_payload ?? "").trim())
      .filter((t) => t.length > 0);
  }

  return {
    ...(data as Omit<IncidentSeed, "signal_samples">),
    signal_samples: signalSamples,
  };
};

// ─── Session-aware orchestrator ───────────────────────────────────────────────

export type RunSessionParams = {
  session_id: string;
  incident_id: string;
  user_id?: string;
};

export const runOrchestratorWithSession = async (
  p: RunSessionParams,
): Promise<OrchestratorResult> => {
  try {
    // Phase 1 — Classify
    await updateSessionStatus(p.session_id, { phase: "classify" });
    const incident = await loadIncidentSeed(p.incident_id);
    const classified = await runClassify(p.session_id, incident);

    // Phase 2 — Investigate
    await updateSessionStatus(p.session_id, { phase: "investigate" });
    const investigated = await runInvestigate(p.session_id, incident, classified);

    // Phase 3 — Compose
    await updateSessionStatus(p.session_id, { phase: "compose" });
    const composeOutput: ComposeOutput = await runCompose(p.session_id, incident, classified, investigated);
    const { draft_8d, report_id } = composeOutput;

    // Phase 4 — Propose
    await updateSessionStatus(p.session_id, { phase: "propose" });
    const initiatives = await runPropose(
      p.session_id,
      incident,
      classified,
      investigated,
      draft_8d,
    );

    const result: OrchestratorResult = {
      incident_id: p.incident_id,
      archetype: classified.archetype,
      tool_calls: investigated.tool_calls,
      draft_8d,
      initiatives,
      phases: [
        { phase: "classify", detail: `Archetype: ${classified.archetype}` },
        {
          phase: "investigate",
          detail: `${investigated.tool_calls.length} tool calls`,
        },
        {
          phase: "compose",
          detail: `8D composed with ${draft_8d.evidence.length} citations`,
        },
        {
          phase: "propose",
          detail: `${initiatives.length} initiatives`,
        },
      ],
    };

    // Patch report with initiatives + tool_calls so the report endpoint can serve everything
    if (report_id) {
      const supabase = getSupabaseServerClient();
      await supabase
        .from("report")
        .update({
          report_8d: {
            ...(draft_8d as unknown as Record<string, unknown>),
            _initiatives: initiatives as unknown as unknown[],
            _tool_calls: investigated.tool_calls as unknown as unknown[],
            _archetype: classified.archetype,
          } as unknown as Record<string, unknown>,
        })
        .eq("id", report_id);
    }

    await updateSessionStatus(p.session_id, {
      status: "succeeded",
      phase: "complete",
      ended_at: new Date().toISOString(),
    });

    await logEvent(p.session_id, "session_complete", {
      archetype: classified.archetype,
      initiative_count: initiatives.length,
      report_id,
    });

    // Publish live so SSE consumers can close the stream immediately
    publishSessionEvent(p.session_id, {
      event_seq: 0,
      event_type: "session_complete",
      payload: { archetype: classified.archetype, initiative_count: initiatives.length, report_id },
      ts: new Date().toISOString(),
    });

    return result;
  } catch (err) {
    const failureReason = isEvidenceCiteUnfixable(err)
      ? "evidence_cite_unfixable"
      : isMaxTurnsError(err)
        ? "max_turns"
        : isApiError(err)
          ? "api_error_exhausted"
          : "orchestrator_crash";

    await updateSessionStatus(p.session_id, {
      status: "failed",
      ended_at: new Date().toISOString(),
      failure_reason: failureReason,
    });

    await logEvent(p.session_id, "session_failed", {
      error: (err as Error).message,
      reason: failureReason,
    });

    // Publish live so SSE consumers know the session ended
    publishSessionEvent(p.session_id, {
      event_seq: 0,
      event_type: "session_failed",
      payload: { reason: failureReason },
      ts: new Date().toISOString(),
    });

    throw err;
  }
};

// ─── Backward-compat wrapper (used by /api/agent/run) ────────────────────────

export const runOrchestrator = async (incidentId: string): Promise<OrchestratorResult> => {
  const sessionId = await createSession(incidentId, { demo: true });
  return runOrchestratorWithSession({
    session_id: sessionId,
    incident_id: incidentId,
  });
};
