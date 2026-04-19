"use client";

import { ArrowRight, Check, CheckCircle, Sparkles, X } from "lucide-react";
import type {
  Claim,
  HypothesisView,
  ReportToolCall,
} from "@/server/incident/loaders";
import { cn } from "@/lib/utils";
import { shortId } from "@/lib/display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  hypothesis: HypothesisView | null;
  primary: HypothesisView | null;
  claims: Claim[];
  toolCalls: ReportToolCall[];
  onClose: () => void;
  onMakePrimary: (id: string) => void;
  onOpenToolCall: (toolCallId: string) => void;
};

const CONFIDENCE_TIER = (conf: number): { label: string; tint: string; bar: string } => {
  if (conf >= 0.8)
    return { label: "high", tint: "text-emerald-700", bar: "bg-emerald-500" };
  if (conf >= 0.6)
    return { label: "moderate", tint: "text-amber-700", bar: "bg-amber-500" };
  return { label: "low", tint: "text-zinc-500", bar: "bg-zinc-400" };
};

export function HypothesisDetailPanel({
  hypothesis,
  primary,
  claims,
  toolCalls,
  onClose,
  onMakePrimary,
  onOpenToolCall,
}: Props) {
  if (!hypothesis) return null;

  const conf = Math.round(hypothesis.confidence * 100);
  const tier = CONFIDENCE_TIER(hypothesis.confidence);
  const isPrimary = hypothesis.isPrimary;
  const evidenceSet = new Set(hypothesis.supportingEvidence);

  // Reasoning steps: claims that cite at least one of this hypothesis's
  // supporting evidence ids. Each step is one line of AI reasoning grounded
  // in a tool call.
  const reasoningSteps = claims
    .map((c) => ({
      claim: c.claim,
      citedEvidence: c.evidence.filter((e) => evidenceSet.has(e)),
    }))
    .filter((step) => step.citedEvidence.length > 0);

  // Diff vs primary: what evidence primary has that this hypothesis doesn't
  const primaryOnly = primary
    ? primary.supportingEvidence.filter((e) => !evidenceSet.has(e))
    : [];
  const ownOnly = primary
    ? hypothesis.supportingEvidence.filter(
        (e) => !primary.supportingEvidence.includes(e),
      )
    : [];

  const toolCallMap = new Map(toolCalls.map((t) => [t.tool_call_id, t]));

  return (
    <div
      role="dialog"
      aria-label={`Hypothesis ${hypothesis.id}`}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-foreground/40 flex justify-end"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(640px,100vw)] h-full bg-card border-l border-border overflow-auto shadow-xl"
      >
        {/* Sticky header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 z-10">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">
                  Hypothesis · rank #{hypothesis.rank}
                </span>
                {hypothesis.archetypeHint ? (
                  <Badge
                    variant="outline"
                    className="uppercase tracking-wider text-[9px] font-semibold rounded-md px-1.5"
                  >
                    {hypothesis.archetypeHint}
                  </Badge>
                ) : null}
                {isPrimary ? (
                  <Badge className="uppercase tracking-wider text-[9px] font-semibold rounded-md px-1.5 bg-primary text-primary-foreground">
                    <CheckCircle className="size-2.5" />
                    Primary
                  </Badge>
                ) : null}
              </div>
              <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-foreground leading-snug">
                {hypothesis.title}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close hypothesis panel"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Confidence + evidence counts */}
          <section>
            <div className="flex items-baseline gap-3 mb-2">
              <span
                className={cn(
                  "text-3xl font-semibold tabular-nums leading-none",
                  tier.tint,
                )}
              >
                {conf}
                <span className="text-lg">%</span>
              </span>
              <span className={cn("text-xs uppercase tracking-wider font-semibold", tier.tint)}>
                {tier.label} confidence
              </span>
              <div className="flex-1" />
              <span className="text-xs font-mono text-emerald-700">
                ✓ {hypothesis.supportingEvidence.length} supporting
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                ✗ {hypothesis.conflictingEvidence.length} conflicting
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full transition-all", tier.bar)}
                style={{ width: `${conf}%` }}
              />
            </div>
          </section>

          {/* Full narrative */}
          <section>
            <SectionLabel>AI summary</SectionLabel>
            <p className="text-sm text-foreground/85 leading-relaxed m-0">
              {hypothesis.oneLiner}
            </p>
          </section>

          {/* Reasoning chain */}
          <section>
            <SectionLabel>
              AI reasoning · {reasoningSteps.length} step
              {reasoningSteps.length === 1 ? "" : "s"}
            </SectionLabel>
            {reasoningSteps.length === 0 ? (
              <p className="text-xs text-muted-foreground italic m-0">
                No structured reasoning was cited for this hypothesis. The
                ranking comes from evidence-token overlap with the root-cause
                string.
              </p>
            ) : (
              <ol className="flex flex-col gap-2 m-0 p-0 list-none">
                {reasoningSteps.map((step, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-border/70 bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-mono font-semibold text-primary mt-0.5">
                        {i + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground/85 leading-relaxed m-0">
                          {step.claim}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                            cites
                          </span>
                          {step.citedEvidence.map((e) => {
                            const tc = toolCallMap.get(e);
                            return (
                              <button
                                key={e}
                                type="button"
                                onClick={() => onOpenToolCall(e)}
                                title={tc?.tool ?? e}
                                className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                              >
                                {shortId(e)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Evidence list (own) */}
          <section>
            <SectionLabel>Evidence trail · {hypothesis.supportingEvidence.length}</SectionLabel>
            <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
              {hypothesis.supportingEvidence.map((e) => {
                const tc = toolCallMap.get(e);
                return (
                  <li key={e}>
                    <button
                      type="button"
                      onClick={() => onOpenToolCall(e)}
                      disabled={!tc}
                      className={cn(
                        "w-full text-left px-2.5 py-2 rounded-md border border-border/70 bg-muted/30 flex items-center gap-2 text-xs",
                        tc && "hover:bg-muted/60 hover:border-primary/30 cursor-pointer transition-colors",
                        !tc && "cursor-default opacity-70",
                      )}
                    >
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] font-medium px-1.5 py-0 h-5 shrink-0"
                      >
                        {shortId(e)}
                      </Badge>
                      {tc ? (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-muted-foreground text-[11px] shrink-0">
                            {tc.tool}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="flex-1 truncate">{tc.summary || "(no summary)"}</span>
                          <ArrowRight className="size-3 text-muted-foreground/60 shrink-0" />
                        </>
                      ) : (
                        <span className="text-muted-foreground/60 text-[11px]">
                          reference — no tool call found
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Why not primary */}
          {!isPrimary && primary ? (
            <section>
              <SectionLabel>Why not primary?</SectionLabel>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-foreground/85 leading-relaxed space-y-2">
                {primaryOnly.length > 0 ? (
                  <p className="m-0">
                    The primary hypothesis cites{" "}
                    <span className="font-mono font-semibold">{primaryOnly.length}</span>{" "}
                    pieces of evidence that this one doesn&apos;t:{" "}
                    {primaryOnly.slice(0, 4).map((e, i) => (
                      <span key={e}>
                        {i > 0 ? ", " : ""}
                        <button
                          type="button"
                          onClick={() => onOpenToolCall(e)}
                          className="font-mono text-[10px] px-1 py-0 rounded bg-card border border-border hover:border-primary/50"
                        >
                          {shortId(e)}
                        </button>
                      </span>
                    ))}
                    {primaryOnly.length > 4 ? <span> · +{primaryOnly.length - 4} more</span> : null}
                    .
                  </p>
                ) : null}
                {ownOnly.length > 0 ? (
                  <p className="m-0">
                    This hypothesis adds{" "}
                    <span className="font-mono font-semibold">{ownOnly.length}</span>{" "}
                    unique evidence reference{ownOnly.length === 1 ? "" : "s"} the primary
                    doesn&apos;t cite — worth reviewing if you disagree with
                    the current ranking.
                  </p>
                ) : null}
                {primaryOnly.length === 0 && ownOnly.length === 0 ? (
                  <p className="m-0">
                    Evidence sets overlap completely. The rank gap comes from
                    base prior (primary gets +0.1 nudge) + claim-token overlap,
                    not from missing evidence.
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Action */}
          {!isPrimary ? (
            <section className="pt-2 border-t border-border/60 flex items-center gap-2">
              <div className="flex-1 text-xs text-muted-foreground">
                Disagree with the ranking? Promote this hypothesis to primary —
                the canvas updates immediately for the engineering team.
              </div>
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  onMakePrimary(hypothesis.id);
                  onClose();
                }}
              >
                <Check className="size-3" />
                Make primary
              </Button>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
      {children}
    </div>
  );
}
