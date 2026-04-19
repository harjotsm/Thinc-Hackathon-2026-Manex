"use client";

import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
  ListChecks,
  Scan,
  Search,
  Terminal,
} from "lucide-react";
import type {
  Claim,
  ReportArchetype,
  ReportInitiative,
  ReportToolCall,
} from "@/server/incident/loaders";
import { cn } from "@/lib/utils";
import { shortId } from "@/lib/display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  archetype: ReportArchetype;
  toolCalls: ReportToolCall[];
  claims: Claim[];
  initiatives: ReportInitiative[];
  problemStatement: string;
  composedAt: string | null;
  composedByModel: string | null;
  onOpenToolCall: (toolCallId: string) => void;
};

type Step = {
  id: string;
  phase: "classify" | "investigate" | "compose" | "propose";
  title: string;
  detail: string;
  tool?: string;
  toolCallId?: string;
};

export function ReasoningTimeline({
  archetype,
  toolCalls,
  claims,
  initiatives,
  problemStatement,
  composedAt,
  composedByModel,
  onOpenToolCall,
}: Props) {
  const [open, setOpen] = useState(false);

  const steps: Step[] = [
    {
      id: "classify",
      phase: "classify",
      title: `Classified incident as ${archetype ?? "unknown"}`,
      detail: archetype
        ? `Archetype prior set to ${archetype}. Investigation tools will be biased toward this archetype's signal domains.`
        : "Archetype couldn't be determined from signal text — investigation runs in neutral mode.",
    },
    ...toolCalls.map((t, i) => ({
      id: t.tool_call_id,
      phase: "investigate" as const,
      title: t.tool,
      detail: t.summary || `Tool call #${i + 1} · no summary emitted`,
      tool: t.tool,
      toolCallId: t.tool_call_id,
    })),
    {
      id: "compose",
      phase: "compose",
      title: `Composed draft 8D · ${claims.length} claim${claims.length === 1 ? "" : "s"}`,
      detail: problemStatement,
    },
    {
      id: "propose",
      phase: "propose",
      title: `Proposed ${initiatives.length} initiative${initiatives.length === 1 ? "" : "s"}`,
      detail: initiatives.length > 0
        ? initiatives
            .map((i) => `${i.domain} → ${i.target_system}`)
            .join(" · ")
        : "No initiatives proposed.",
    },
  ];

  const stepCount = steps.length;
  const toolCallCount = toolCalls.length;

  return (
    <section
      data-testid="reasoning-timeline"
      className="rounded-lg border border-border/70 bg-card overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="reasoning-timeline-body"
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="inline-flex items-center justify-center size-6 rounded bg-primary/10 text-primary shrink-0">
          <Scan className="size-3.5" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-primary">
            AI reasoning timeline
          </div>
          <div className="text-xs text-muted-foreground">
            {stepCount} steps · {toolCallCount} tool call
            {toolCallCount === 1 ? "" : "s"}
            {composedByModel ? ` · ${composedByModel}` : ""}
            {composedAt
              ? ` · composed ${new Date(composedAt).toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : ""}
          </div>
        </div>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div
          id="reasoning-timeline-body"
          className="border-t border-border/60 px-4 py-4"
        >
          <ol className="relative flex flex-col gap-0 m-0 p-0 list-none">
            {/* vertical spine */}
            <span
              aria-hidden
              className="absolute left-3 top-3 bottom-3 w-px bg-border/80"
            />
            {steps.map((step, i) => (
              <StepRow
                key={step.id}
                step={step}
                isFirst={i === 0}
                isLast={i === steps.length - 1}
                onOpenToolCall={onOpenToolCall}
              />
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function StepRow({
  step,
  isFirst,
  isLast,
  onOpenToolCall,
}: {
  step: Step;
  isFirst: boolean;
  isLast: boolean;
  onOpenToolCall: (id: string) => void;
}) {
  const Icon =
    step.phase === "classify"
      ? Search
      : step.phase === "investigate"
        ? Terminal
        : step.phase === "compose"
          ? FileText
          : ListChecks;

  const tint =
    step.phase === "classify"
      ? "bg-blue-100 text-blue-700"
      : step.phase === "investigate"
        ? "bg-violet-100 text-violet-700"
        : step.phase === "compose"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700";

  return (
    <li
      className={cn(
        "relative flex items-start gap-3 pl-0",
        !isLast && "pb-3",
        !isFirst && "pt-3",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative z-10 inline-flex items-center justify-center size-6 rounded-full ring-2 ring-card shrink-0",
          tint,
        )}
      >
        <Icon className="size-3" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="uppercase text-[9px] font-semibold tracking-wider px-1.5 py-0 h-4"
          >
            {step.phase}
          </Badge>
          <span className="text-[13px] font-semibold text-foreground">
            {step.title}
          </span>
          {step.toolCallId ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px]"
              onClick={() => onOpenToolCall(step.toolCallId!)}
            >
              {shortId(step.toolCallId)}
              <ArrowRight className="size-3" />
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed m-0 mt-0.5 line-clamp-2">
          {step.detail}
        </p>
      </div>
    </li>
  );
}
