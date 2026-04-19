"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type State = "idle" | "dispatching" | "done" | "error";

export function RunAiButton({ incidentId }: { incidentId: string }) {
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleClick = async () => {
    if (state === "dispatching") return;
    setState("dispatching");
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/incident/${incidentId}/investigate`, {
        method: "POST",
      });

      if (res.ok || res.status === 202) {
        setState("done");
        setTimeout(() => {
          router.refresh();
        }, 2000);
      } else {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.message) msg = body.message;
          else if (body?.code) msg = body.code;
        } catch {
          // ignore JSON parse failure
        }
        setState("error");
        setErrorMsg(msg);
      }
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    }
  };

  const label =
    state === "dispatching"
      ? "Running…"
      : state === "done"
        ? "Dispatched ✓"
        : state === "error"
          ? "Error — retry?"
          : "Run AI ↻";

  return (
    <button
      className="btn ghost sm"
      type="button"
      title={
        state === "error" && errorMsg
          ? errorMsg
          : "Re-run AI orchestrator"
      }
      disabled={state === "dispatching"}
      onClick={handleClick}
      aria-busy={state === "dispatching"}
    >
      {state === "dispatching" ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              border: "2px solid currentColor",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }}
          />
          {label}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
