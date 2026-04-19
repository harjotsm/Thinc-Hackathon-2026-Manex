/**
 * GET /api/session/[sessionId]/stream
 *
 * SSE endpoint that:
 *  1. Replays historical session_event rows (ordered by event_seq) since the
 *     last-seen sequence number (via Last-Event-ID header or ?since= query).
 *  2. Subscribes to the in-process event-bus for live events.
 *  3. Sends a heartbeat comment every 15 s to keep proxies alive.
 *
 * NOTE: The event-bus is a module-level EventEmitter and is therefore per-process.
 * In a multi-worker deployment, live events emitted by a different worker will not
 * reach this SSE connection. For the hackathon/demo single-process setup this is fine.
 *
 * The endpoint stays open until the client disconnects (request abort). Auto-close
 * on session terminal state is deferred to M6b.
 */

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { subscribeSessionEvents } from "@/lib/event-bus";

export const runtime = "nodejs"; // not edge — event-bus uses module-level EventEmitter
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ sessionId: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { sessionId } = await params;

  const url = new URL(req.url);
  // Prefer Last-Event-ID header over ?since= query param (spec §6.5 reconnect)
  const lastEventIdHeader = req.headers.get("last-event-id");
  const sinceStr = lastEventIdHeader ?? url.searchParams.get("since") ?? "0";
  const since = Number.parseInt(sinceStr, 10) || 0;

  const encoder = new TextEncoder();
  let closed = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let unsubLive: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream already closed — swallow silently
        }
      };

      const emit = (ev: {
        event_seq: number;
        event_type: string;
        payload: unknown;
        ts: string;
      }) => {
        const lines = [
          `id: ${ev.event_seq}`,
          `event: ${ev.event_type}`,
          `data: ${JSON.stringify({ session_id: sessionId, ...ev })}`,
          ``,
          ``,
        ];
        write(lines.join("\n"));
      };

      // ── 1. Replay from DB ─────────────────────────────────────────────────
      const supabase = getSupabaseServerClient();
      const { data: backlog } = await supabase
        .from("session_event")
        .select("event_seq, event_type, payload, ts")
        .eq("session_id", sessionId)
        .gt("event_seq", since)
        .order("event_seq", { ascending: true })
        .limit(1000);

      for (const ev of backlog ?? []) {
        emit(ev as { event_seq: number; event_type: string; payload: unknown; ts: string });
      }

      // ── 2. Live subscription via event-bus ───────────────────────────────
      unsubLive = subscribeSessionEvents(sessionId, (ev) => {
        emit({
          event_seq: ev.event_seq,
          event_type: ev.event_type,
          payload: ev.payload,
          ts: ev.ts,
        });
      });

      // ── 3. Heartbeat every 15 s ──────────────────────────────────────────
      heartbeatTimer = setInterval(() => write(":\n\n"), 15_000);

      // Wire abort signal so we clean up promptly when client disconnects
      req.signal.addEventListener("abort", () => {
        closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (unsubLive) unsubLive();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },

    cancel() {
      closed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (unsubLive) unsubLive();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
