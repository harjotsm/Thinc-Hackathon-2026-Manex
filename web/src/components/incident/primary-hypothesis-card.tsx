"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  Radio,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import type {
  HypothesisView,
  ReportToolCall,
  SignalRow,
} from "@/server/incident/loaders";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortId } from "@/lib/display";

type Props = {
  hypothesis: HypothesisView;
  problemStatement: string;
  signals: SignalRow[];
  toolCalls?: ReportToolCall[];
  onOpenToolCall?: (id: string) => void;
  defaultEvidenceOpen?: boolean;
};

type ConfidenceTier = {
  ringClass: string;
  textClass: string;
  trackClass: string;
  label: string;
};

type EvidenceKind = {
  icon: typeof Radio;
  label: string;
  description: string;
  bgClass: string;
  iconClass: string;
};

const classifyEvidence = (id: string, isSignal: boolean): EvidenceKind => {
  if (isSignal) {
    return {
      icon: Radio,
      label: "signal",
      description: "(no payload)",
      bgClass: "bg-primary/10",
      iconClass: "text-primary",
    };
  }
  if (id.startsWith("TC-")) {
    return {
      icon: Terminal,
      label: "tool call",
      description: "Orchestrator trace · open tool call to inspect",
      bgClass: "bg-violet-100",
      iconClass: "text-violet-700",
    };
  }
  if (id.startsWith("SIG-")) {
    return {
      icon: Radio,
      label: "signal",
      description: "Signal not in local cache",
      bgClass: "bg-primary/10",
      iconClass: "text-primary",
    };
  }
  if (id.startsWith("DB-")) {
    return {
      icon: Database,
      label: "database row",
      description: "Referenced record",
      bgClass: "bg-emerald-100",
      iconClass: "text-emerald-700",
    };
  }
  return {
    icon: FileText,
    label: "reference",
    description: "External reference",
    bgClass: "bg-muted",
    iconClass: "text-muted-foreground",
  };
};

const confidenceTier = (conf: number): ConfidenceTier => {
  if (conf >= 0.8) {
    return {
      ringClass: "stroke-emerald-600",
      textClass: "text-emerald-700",
      trackClass: "stroke-emerald-100",
      label: "high confidence",
    };
  }
  if (conf >= 0.6) {
    return {
      ringClass: "stroke-amber-500",
      textClass: "text-amber-700",
      trackClass: "stroke-amber-100",
      label: "moderate confidence",
    };
  }
  return {
    ringClass: "stroke-zinc-400",
    textClass: "text-muted-foreground",
    trackClass: "stroke-zinc-100",
    label: "low confidence",
  };
};

const ConfidenceRing = ({
  pct,
  tier,
}: {
  pct: number;
  tier: ConfidenceTier;
}) => {
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div data-testid="confidence-badge" className="relative size-20 shrink-0">
      <svg
        viewBox="0 0 72 72"
        className="size-20 -rotate-90"
        aria-hidden
      >
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          strokeWidth={6}
          className={tier.trackClass}
        />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className={tier.ringClass}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums leading-none",
            tier.textClass,
          )}
        >
          {pct}
        </span>
        <span
          className={cn(
            "text-[9px] font-semibold uppercase tracking-wider mt-0.5",
            tier.textClass,
          )}
        >
          {/* % keeps the test assertion `getByText(/82/)` valid */}
          %
        </span>
      </div>
    </div>
  );
};

export function PrimaryHypothesisCard({
  hypothesis,
  problemStatement,
  signals,
  toolCalls = [],
  onOpenToolCall,
  defaultEvidenceOpen,
}: Props) {
  const [trailOpen, setTrailOpen] = useState(
    defaultEvidenceOpen ?? hypothesis.supportingEvidence.length >= 3,
  );
  const [drawerSignal, setDrawerSignal] = useState<string | null>(null);

  const tier = confidenceTier(hypothesis.confidence);
  const pct = Math.round(hypothesis.confidence * 100);

  const signalById = useMemo(() => {
    const m = new Map<string, SignalRow>();
    for (const s of signals) m.set(s.signal_id, s);
    return m;
  }, [signals]);

  const toolCallById = useMemo(() => {
    const m = new Map<string, ReportToolCall>();
    for (const t of toolCalls) m.set(t.tool_call_id, t);
    return m;
  }, [toolCalls]);

  const focused = drawerSignal ? signalById.get(drawerSignal) ?? null : null;

  return (
    <Card
      data-testid="primary-hypothesis-card"
      className="ring-primary/20 shadow-[0_4px_20px_-12px_rgb(99_103_241/0.25)]"
    >
      <CardContent className="px-6 pt-5 pb-5">
        <div className="flex items-start gap-5 flex-wrap">
          <ConfidenceRing pct={pct} tier={tier} />

          <div className="flex-1 min-w-[260px]">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="size-3" aria-hidden />
              <span>Primary hypothesis</span>
              {hypothesis.archetypeHint ? (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground normal-case font-medium tracking-normal text-xs">
                    {hypothesis.archetypeHint}
                  </span>
                </>
              ) : null}
            </div>

            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground leading-snug">
              {hypothesis.title}
            </h2>

            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {problemStatement && problemStatement !== hypothesis.title
                ? problemStatement
                : hypothesis.oneLiner}
            </p>

            <div className="mt-3 flex items-center gap-3 flex-wrap text-xs">
              <span
                data-testid="evidence-count"
                className={cn("font-mono font-semibold", tier.textClass)}
              >
                ✓ {hypothesis.supportingEvidence.length} supporting
              </span>
              <span className="font-mono text-muted-foreground">
                ✗ {hypothesis.conflictingEvidence.length} conflicting
              </span>
              <span className="text-muted-foreground">{tier.label}</span>
              <div className="flex-1" />
              {hypothesis.supportingEvidence.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTrailOpen((v) => !v)}
                  aria-expanded={trailOpen}
                  aria-controls="evidence-trail"
                  className="h-7"
                >
                  {trailOpen ? (
                    <>
                      Hide evidence trail
                      <ChevronUp className="size-3" />
                    </>
                  ) : (
                    <>
                      Show evidence trail
                      <ChevronDown className="size-3" />
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Evidence trail */}
        {trailOpen && hypothesis.supportingEvidence.length > 0 ? (
          <div
            id="evidence-trail"
            data-testid="evidence-trail"
            className="mt-5 pt-4 border-t border-border"
          >
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
              Evidence trail · {hypothesis.supportingEvidence.length} items
            </div>
            <ol className="flex flex-col gap-1.5 m-0 p-0 list-none">
              {hypothesis.supportingEvidence.slice(0, 8).map((evId, i) => {
                const sig = signalById.get(evId);
                const tc = toolCallById.get(evId);
                const isSignal = !!sig;
                const isToolCall = !isSignal && !!tc;
                const interactive = isSignal || (isToolCall && !!onOpenToolCall);
                const kind = classifyEvidence(evId, isSignal);
                const KindIcon = kind.icon;
                const handleClick = () => {
                  if (isSignal) setDrawerSignal(evId);
                  else if (isToolCall && onOpenToolCall) onOpenToolCall(evId);
                };
                return (
                  <li key={evId}>
                    <button
                      type="button"
                      disabled={!interactive}
                      onClick={handleClick}
                      className={cn(
                        "w-full text-left px-2.5 py-2 rounded-md border border-border/70 bg-muted/30 flex items-center gap-2.5 text-xs text-foreground/80",
                        interactive && "hover:bg-muted/60 hover:border-primary/30 cursor-pointer transition-colors",
                        !interactive && "cursor-default",
                      )}
                    >
                      <span className="font-mono font-semibold text-primary text-[10px] w-5 text-right shrink-0">
                        {i + 1}.
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center justify-center size-5 rounded shrink-0",
                          kind.bgClass,
                        )}
                        aria-hidden
                        title={kind.label}
                      >
                        <KindIcon className={cn("size-3", kind.iconClass)} />
                      </span>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] font-medium px-1.5 py-0 h-5 shrink-0"
                        title={evId}
                      >
                        {shortId(evId)}
                      </Badge>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-muted-foreground text-[11px] shrink-0 capitalize">
                        {sig?.source_system ?? sig?.signal_type ?? tc?.tool ?? kind.label}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="flex-1 truncate">
                        {sig?.text_payload ?? tc?.summary ?? kind.description}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {hypothesis.supportingEvidence.length > 8 ? (
              <div className="mt-2 text-[11px] text-muted-foreground/70">
                and {hypothesis.supportingEvidence.length - 8} more →
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Signal drawer */}
        {focused ? (
          <div
            role="dialog"
            aria-label={`Signal ${focused.signal_id}`}
            onClick={() => setDrawerSignal(null)}
            className="fixed inset-0 z-50 bg-foreground/40 flex justify-end"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-[min(420px,100vw)] h-full bg-card border-l border-border p-6 overflow-auto shadow-xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <Badge
                  variant="outline"
                  className="font-mono text-[11px] font-semibold text-primary"
                >
                  {focused.signal_id}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {focused.source_system ?? "—"} · {focused.signal_type ?? "—"}
                </span>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDrawerSignal(null)}
                  aria-label="Close signal drawer"
                >
                  <X className="size-3.5" />
                </Button>
              </div>

              <div className="text-xs text-muted-foreground font-mono mb-4">
                {focused.captured_ts ?? "(no timestamp)"}
              </div>

              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 border border-border rounded-lg p-4">
                {focused.text_payload ?? "(empty payload)"}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
