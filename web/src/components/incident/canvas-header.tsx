import Link from "next/link";
import { ArrowLeft, Check, Circle } from "lucide-react";
import type { IncidentRow, ReportArchetype } from "@/server/incident/loaders";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RunAiButton } from "./run-ai-button";

type Phase = {
  id: "detect" | "find" | "explain" | "lead" | "suggest" | "track";
  label: string;
  state: "done" | "current" | "pending";
};

type Props = {
  incident: IncidentRow;
  signalCount: number;
  contributionCount: number;
  initiativeCount: number;
  hasPrimaryHypothesis: boolean;
  hasEvidenceTrail: boolean;
  hasRealContributions: boolean;
  hasDispatchedInitiative: boolean;
  archetype: ReportArchetype;
  lastActivityAt: string | null;
};

const ARCHETYPE_BADGE: Record<string, string> = {
  supplier: "bg-orange-100 text-orange-800 border-orange-200",
  drift:    "bg-amber-100 text-amber-800 border-amber-200",
  design:   "bg-pink-100 text-pink-800 border-pink-200",
  operator: "bg-violet-100 text-violet-800 border-violet-200",
  unknown:  "bg-zinc-100 text-zinc-700 border-zinc-200",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  medium:   "bg-amber-100 text-amber-700 border-amber-200",
  low:      "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const formatRelative = (iso: string | null): string => {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

export function CanvasHeader({
  incident,
  signalCount,
  contributionCount,
  initiativeCount,
  hasPrimaryHypothesis,
  hasEvidenceTrail,
  hasRealContributions,
  hasDispatchedInitiative,
  archetype,
  lastActivityAt,
}: Props) {
  const sevKey = (incident.severity ?? "medium").toLowerCase();
  const sev = SEVERITY_BADGE[sevKey] ?? SEVERITY_BADGE.medium;
  const arch = ARCHETYPE_BADGE[archetype ?? "unknown"];

  const phases: Phase[] = [
    { id: "detect", label: "Detect", state: "done" },
    { id: "find", label: "Find cause", state: hasPrimaryHypothesis ? "current" : "pending" },
    { id: "explain", label: "Explain", state: hasEvidenceTrail ? "done" : "pending" },
    { id: "lead", label: "Lead", state: hasRealContributions ? "done" : "pending" },
    { id: "suggest", label: "Suggest", state: initiativeCount > 0 ? "done" : "pending" },
    { id: "track", label: "Track", state: hasDispatchedInitiative ? "done" : "pending" },
  ];

  return (
    <div
      data-testid="canvas-header"
      className="bg-card border-b border-border px-6 py-4"
    >
      <div className="flex items-start gap-3 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/inbox" />}
          className="shrink-0 mt-0.5"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              className={cn(
                "uppercase tracking-wider text-[10px] font-semibold rounded-md px-1.5",
                sev,
              )}
            >
              {sevKey}
            </Badge>
            {archetype ? (
              <Badge
                className={cn(
                  "uppercase tracking-wider text-[10px] font-semibold rounded-md px-1.5",
                  arch,
                )}
              >
                {archetype}
              </Badge>
            ) : null}
            <h1 className="text-base font-semibold text-foreground tracking-tight">
              {incident.title ?? incident.incident_id}
            </h1>
          </div>
          <div className="mt-1 text-xs text-muted-foreground font-mono">
            {incident.incident_id}
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            {signalCount} signals
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            {contributionCount} contributions
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            last activity {formatRelative(lastActivityAt)}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <RunAiButton incidentId={incident.incident_id} />
          <Button
            variant="default"
            size="sm"
            render={<Link href={`/incident/${incident.incident_id}/resolve`} />}
          >
            Dispatch all
          </Button>
        </div>
      </div>

      {/* Phase pills — Tabs-styled connector for the 4-phase pipeline */}
      <div
        data-testid="phase-pills"
        className="mt-4 flex items-center flex-wrap gap-y-1"
      >
        {phases.map((phase, i) => {
          const isDone = phase.state === "done";
          const isCurrent = phase.state === "current";
          return (
            <div key={phase.id} className="flex items-center">
              <span
                data-testid={`phase-pill-${phase.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  isDone &&
                    "bg-primary/10 text-primary",
                  isCurrent &&
                    "bg-primary text-primary-foreground shadow-sm",
                  !isDone &&
                    !isCurrent &&
                    "bg-muted text-muted-foreground/70",
                )}
              >
                {isDone ? (
                  <>
                    <Check className="size-3" aria-hidden />
                    <span>✓ {phase.label}</span>
                  </>
                ) : isCurrent ? (
                  <>
                    <span className="size-2 rounded-full bg-primary-foreground" />
                    <span>● {phase.label}</span>
                  </>
                ) : (
                  <>
                    <Circle className="size-3 opacity-40" aria-hidden />
                    <span>○ {phase.label}</span>
                  </>
                )}
              </span>
              {i < phases.length - 1 ? (
                <span
                  aria-hidden
                  className="mx-1 h-px w-3 bg-border"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
