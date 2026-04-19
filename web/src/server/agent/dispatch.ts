import "server-only";
import { after } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { runOrchestratorWithSession } from "@/server/agent/orchestrator";

export type DispatchOptions = {
  incidentId: string;
  triggeredBy: "correlator" | "manual" | "scheduler";
  /** Skip dispatch if a completed session exists within this many minutes. Default: 30. */
  maxFreshnessMinutes?: number;
};

export type DispatchResult =
  | { dispatched: true; session_id: string }
  | { dispatched: false; reason: string };

/**
 * Idempotent, non-blocking orchestrator dispatch.
 *
 * Decision rules (in order):
 *   1. A "running" session exists for this incident → skip (already in flight).
 *   2. A "succeeded" or "failed" session was created within maxFreshnessMinutes → skip
 *      (prevents thundering-herd re-analysis on rapid signal bursts).
 *   3. Otherwise: create a new session row and register an after() callback.
 *
 * after() is a Next.js primitive that runs the callback after the HTTP response
 * is flushed. It is safe to call from any server context (Route Handler,
 * Server Action, middleware). When running outside the Next.js request lifecycle
 * (e.g., in Vitest) the callback would throw — callers must mock it there.
 */
export const maybeDispatchOrchestrator = async (
  opts: DispatchOptions,
): Promise<DispatchResult> => {
  const { incidentId, triggeredBy, maxFreshnessMinutes = 30 } = opts;

  const supabase = getSupabaseServerClient();

  // 1. Check for any running session
  const { data: runningSession, error: runningError } = await supabase
    .from("session")
    .select("id")
    .eq("incident_id", incidentId)
    .eq("status", "running")
    .maybeSingle();

  if (runningError) {
    // Conservative: don't dispatch if we can't read session state (avoids duplicates)
    return {
      dispatched: false,
      reason: `session_query_error: ${runningError.message}`,
    };
  }

  if (runningSession) {
    return { dispatched: false, reason: "session_already_running" };
  }

  // 2. Check for a recent completed/failed session within the freshness window
  const windowStart = new Date(
    Date.now() - maxFreshnessMinutes * 60 * 1000,
  ).toISOString();

  const { data: recentSession, error: recentError } = await supabase
    .from("session")
    .select("id,started_at")
    .eq("incident_id", incidentId)
    .in("status", ["succeeded", "failed"])
    .gte("started_at", windowStart)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentError) {
    // Conservative: skip if uncertain
    return {
      dispatched: false,
      reason: `recent_session_query_error: ${recentError.message}`,
    };
  }

  if (recentSession) {
    return { dispatched: false, reason: "recent_session" };
  }

  // 3. Create a new session row
  const sessionId = makeId("SES");
  const now = new Date().toISOString();

  const { error: insertError } = await supabase.from("session").insert({
    id: sessionId,
    incident_id: incidentId,
    phase: "classify",
    status: "running",
    started_at: now,
    // Correlator / scheduler dispatches are system-initiated; no human user_id
    created_by_user_id: null,
  });

  if (insertError) {
    const msg = insertError.message ?? "";
    // Race condition: unique partial index on (incident_id) WHERE status='running'
    if (msg.toLowerCase().includes("unique") || insertError.code === "23505") {
      return { dispatched: false, reason: "session_already_running" };
    }
    // Any other insert error — do not throw; correlator must not fail
    return {
      dispatched: false,
      reason: `session_insert_error: ${msg}`,
    };
  }

  // 4. Fire the orchestrator after the HTTP response is flushed
  after(async () => {
    try {
      await runOrchestratorWithSession({
        session_id: sessionId,
        incident_id: incidentId,
        user_id: undefined,
      });
    } catch (err) {
      // runOrchestratorWithSession already persists status=failed + logs internally.
      // We only surface here for operator visibility.
      console.error(
        `[dispatch/${triggeredBy} ${sessionId}] orchestrator error:`,
        err,
      );
    }
  });

  return { dispatched: true, session_id: sessionId };
};
