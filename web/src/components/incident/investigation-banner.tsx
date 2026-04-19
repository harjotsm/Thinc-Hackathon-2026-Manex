"use client";

import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunAiStatus } from "./run-ai-button";

type Props = {
  status: RunAiStatus | null;
};

// 4-phase orchestrator cadence used to surface *what* the AI is likely doing
// right now. The backend runs Classify → Investigate → Compose → Propose
// serially inside a single after() callback, so we stage the banner copy off
// elapsed time to give the user a believable progress narrative.
const PHASES: Array<{ label: string; from: number; to: number }> = [
  { label: "Classifying incident archetype",   from: 0,     to: 8_000  },
  { label: "Investigating signals · calling tools", from: 8_000, to: 45_000 },
  { label: "Composing 8D draft · grounding in evidence", from: 45_000, to: 75_000 },
  { label: "Proposing initiatives · almost done", from: 75_000, to: 95_000 },
];

const currentPhase = (ms: number) => {
  for (const p of PHASES) {
    if (ms >= p.from && ms < p.to) return p;
  }
  return PHASES[PHASES.length - 1];
};

export function InvestigationBanner({ status }: Props) {
  if (!status) return null;
  const active =
    status.state === "running" ||
    (status.state === "done" && status.isPolling);
  if (!active) return null;

  const elapsedS = Math.floor(status.elapsedMs / 1000);
  const phase = currentPhase(status.elapsedMs);
  const progressPct = Math.min(100, Math.round((status.elapsedMs / 90_000) * 100));

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="investigation-banner"
      className={cn(
        "sticky top-0 z-40 border-b border-primary/20",
        "bg-primary/5 backdrop-blur",
      )}
    >
      <div className="px-6 py-2.5 flex items-center gap-3">
        <span className="relative inline-flex shrink-0">
          <Loader2 className="size-4 text-primary animate-spin" aria-hidden />
        </span>
        <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
          <Sparkles className="size-3 text-primary shrink-0" aria-hidden />
          <span className="font-semibold text-primary tracking-tight shrink-0">
            AI is investigating
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-foreground/80 truncate">{phase.label}</span>
        </div>
        <span className="font-mono tabular-nums text-[11px] text-muted-foreground shrink-0">
          {elapsedS}s elapsed · auto-refreshes every 3s
        </span>
      </div>
      <div className="h-0.5 bg-primary/10 overflow-hidden">
        <div
          className="h-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
