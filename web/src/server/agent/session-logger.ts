import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";

export type PhaseName =
  | "classify"
  | "investigate"
  | "compose"
  | "propose"
  | "complete"
  | "failed";

export type TurnInsert = {
  session_id: string;
  turn_index: number;
  phase: PhaseName;
  role: "assistant" | "tool";
  model?: string;
  content_text?: string;
  tool_call?: unknown;
  tokens_in?: number;
  tokens_out?: number;
  duration_ms?: number;
};

export const logTurn = async (t: TurnInsert): Promise<string> => {
  const supabase = getSupabaseServerClient();
  const turn_id = makeId("ST");
  const { error } = await supabase.from("session_turn").insert({
    id: turn_id,
    ...t,
  });
  if (error) throw new Error(`logTurn failed: ${error.message}`);
  return turn_id;
};

export const logEvent = async (
  session_id: string,
  event_type: string,
  payload: unknown,
): Promise<number> => {
  const supabase = getSupabaseServerClient();
  // event_seq is BIGSERIAL, auto-assigned by PG. Insert then read back via select.
  const { data, error } = await supabase
    .from("session_event")
    .insert({ session_id, event_type, payload })
    .select("event_seq")
    .single();
  if (error) throw new Error(`logEvent failed: ${error.message}`);
  return (data as { event_seq: number }).event_seq;
};

export const logPhaseStart = (
  session_id: string,
  phase: PhaseName,
  payload: Record<string, unknown> = {},
) => logEvent(session_id, "phase_start", { phase, ...payload });

export const logPhaseComplete = (
  session_id: string,
  phase: PhaseName,
  payload: Record<string, unknown> = {},
) => logEvent(session_id, "phase_complete", { phase, ...payload });

export const updateSessionStatus = async (
  session_id: string,
  patch: {
    status?: "running" | "succeeded" | "failed" | "stalled" | "cancelled";
    phase?: PhaseName;
    ended_at?: string;
    total_tokens_in?: number;
    total_tokens_out?: number;
    total_cost_usd?: number;
    failure_reason?: string;
  },
): Promise<void> => {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("session")
    .update(patch)
    .eq("id", session_id);
  if (error) throw new Error(`updateSessionStatus failed: ${error.message}`);
};
