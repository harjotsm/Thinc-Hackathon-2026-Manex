"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type State = "idle" | "running" | "done" | "error";

export type RunAiStatus = {
  state: State;
  elapsedMs: number;
  isPolling: boolean;
  errorMsg: string | null;
};

const POLL_INTERVAL_MS = 3000;
const MAX_ELAPSED_MS = 90_000;

export function RunAiButton({
  incidentId,
  onStatusChange,
}: {
  incidentId: string;
  onStatusChange?: (status: RunAiStatus) => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const isPolling = state === "done" && tickRef.current !== null;

  useEffect(() => {
    onStatusChange?.({ state, elapsedMs: elapsed, isPolling, errorMsg });
  }, [state, elapsed, isPolling, errorMsg, onStatusChange]);

  const stopTicking = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const startPolling = () => {
    const start = Date.now();
    stopTicking();
    tickRef.current = setInterval(() => {
      const e = Date.now() - start;
      setElapsed(e);
      router.refresh();
      if (e >= MAX_ELAPSED_MS) {
        stopTicking();
        setState("done");
      }
    }, POLL_INTERVAL_MS);
  };

  const handleClick = async () => {
    if (state === "running") return;
    setState("running");
    setElapsed(0);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/incident/${incidentId}/investigate`, {
        method: "POST",
      });

      if (res.ok || res.status === 202) {
        // Immediately acknowledge success (test expects "Dispatched" substring)
        // and start pulling fresh server data every 3s.
        setState("done");
        startPolling();
      } else {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.message) msg = body.message;
          else if (body?.code) msg = body.code;
        } catch {
          /* ignore */
        }
        setState("error");
        setErrorMsg(msg);
      }
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    }
  };

  const elapsedS = Math.floor(elapsed / 1000);

  const label =
    state === "running"
      ? "Running…"
      : state === "done"
        ? isPolling
          ? `Dispatched · ${elapsedS}s`
          : "Dispatched ✓"
        : state === "error"
          ? "Error — retry?"
          : "Run AI";

  return (
    <Button
      type="button"
      data-testid="run-ai-button"
      variant={state === "done" && isPolling ? "default" : "outline"}
      size="sm"
      title={
        state === "error" && errorMsg
          ? errorMsg
          : isPolling
            ? "AI orchestrator is investigating. Data auto-refreshes every 3 s."
            : "Re-run AI orchestrator"
      }
      disabled={state === "running"}
      onClick={handleClick}
      aria-busy={state === "running" || isPolling}
      className={cn(isPolling && "animate-pulse")}
    >
      {state === "running" || isPolling ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : state === "done" ? (
        <Sparkles className="size-3.5" aria-hidden />
      ) : (
        <RotateCw className="size-3.5" aria-hidden />
      )}
      {label}
    </Button>
  );
}
