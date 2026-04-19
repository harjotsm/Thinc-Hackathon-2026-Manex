"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import type {
  Claim,
  ContributionRow,
  HypothesisView,
  IncidentRow,
  ReportArchetype,
  ReportInitiative,
  ReportToolCall,
  SignalRow,
} from "@/server/incident/loaders";
import { Button } from "@/components/ui/button";
import { CanvasHeader } from "./canvas-header";
import { PrimaryHypothesisCard } from "./primary-hypothesis-card";
import { AlternativeHypotheses } from "./alternative-hypotheses";
import { InitiativesPreview } from "./initiatives-preview";
import { ContributionsSection } from "./contributions-section";
import { SimilarLessons, type LessonView } from "./similar-lessons";
import { SignalTimeline } from "./signal-timeline";
import { ReasoningTimeline } from "./reasoning-timeline";
import { ToolCallDrawer } from "./tool-call-drawer";
import { HypothesisDetailPanel } from "./hypothesis-detail-panel";

type Props = {
  incident: IncidentRow;
  signals: SignalRow[];
  contributions: ContributionRow[];
  hypotheses: HypothesisView[];
  initiatives: ReportInitiative[];
  problemStatement: string;
  archetype: ReportArchetype;
  lessons: LessonView[];
  composedAt: string | null;
  toolCalls: ReportToolCall[];
  claims: Claim[];
  composedByModel?: string | null;
};

const lastActivityFromBundle = (
  signals: SignalRow[],
  contributions: ContributionRow[],
): string | null => {
  let max: number | null = null;
  for (const s of signals) {
    if (s.captured_ts) {
      const t = new Date(s.captured_ts).getTime();
      if (!Number.isNaN(t) && (max === null || t > max)) max = t;
    }
  }
  for (const c of contributions) {
    if (c.created_ts) {
      const t = new Date(c.created_ts).getTime();
      if (!Number.isNaN(t) && (max === null || t > max)) max = t;
    }
  }
  return max === null ? null : new Date(max).toISOString();
};

export function CanvasView({
  incident,
  signals,
  contributions,
  hypotheses,
  initiatives,
  problemStatement,
  archetype,
  lessons,
  composedAt,
  toolCalls,
  claims,
  composedByModel = null,
}: Props) {
  const [primaryId, setPrimaryId] = useState<string>(hypotheses[0]?.id ?? "");
  // Separate from primary selection: which hypothesis is in focus in the
  // detail panel (null = panel closed). Clicking a node opens the panel
  // without promoting that hypothesis to primary.
  const [focusedHypId, setFocusedHypId] = useState<string | null>(null);
  const [openToolCallId, setOpenToolCallId] = useState<string | null>(null);

  const primary = useMemo(
    () => hypotheses.find((h) => h.id === primaryId) ?? hypotheses[0],
    [hypotheses, primaryId],
  );

  const focusedHyp = useMemo(
    () => hypotheses.find((h) => h.id === focusedHypId) ?? null,
    [hypotheses, focusedHypId],
  );

  const toolCallMap = useMemo(() => {
    const m = new Map<string, ReportToolCall>();
    for (const t of toolCalls) m.set(t.tool_call_id, t);
    return m;
  }, [toolCalls]);

  const openToolCall = openToolCallId ? toolCallMap.get(openToolCallId) ?? null : null;

  const lastActivity = useMemo(
    () => lastActivityFromBundle(signals, contributions) ?? composedAt,
    [signals, contributions, composedAt],
  );

  const realContribs = contributions.filter(
    (c) => c.source && c.source !== "system" && c.status !== "dismissed",
  );

  return (
    <div data-testid="canvas-view" className="flex flex-col">
      <CanvasHeader
        incident={incident}
        signalCount={signals.length}
        contributionCount={contributions.length}
        initiativeCount={initiatives.length}
        hasPrimaryHypothesis={!!primary}
        hasEvidenceTrail={(primary?.supportingEvidence.length ?? 0) > 0}
        hasRealContributions={realContribs.length > 0}
        hasDispatchedInitiative={false}
        archetype={archetype}
        lastActivityAt={lastActivity}
      />

      {signals.length > 0 ? <SignalTimeline signals={signals} /> : null}

      <div className="px-6 py-6 max-w-[1100px] mx-auto w-full space-y-5">
        {primary ? (
          <PrimaryHypothesisCard
            hypothesis={primary}
            problemStatement={problemStatement}
            signals={signals}
            toolCalls={toolCalls}
            onOpenToolCall={(id) => setOpenToolCallId(id)}
          />
        ) : (
          <div
            data-testid="no-hypothesis"
            className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-6 text-center text-sm text-muted-foreground"
          >
            ✦ AI couldn&apos;t identify a primary root cause yet. Try{" "}
            <span className="text-primary font-semibold">Run AI ↻</span> to
            re-investigate.
          </div>
        )}

        {hypotheses.length > 1 && primary ? (
          <AlternativeHypotheses
            hypotheses={hypotheses}
            primaryId={primary.id}
            problemStatement={problemStatement}
            onSelectPrimary={(id) => setPrimaryId(id)}
            onFocusHypothesis={(id) => setFocusedHypId(id)}
            incidentId={incident.incident_id}
          />
        ) : null}

        {toolCalls.length > 0 || claims.length > 0 ? (
          <ReasoningTimeline
            archetype={archetype}
            toolCalls={toolCalls}
            claims={claims}
            initiatives={initiatives}
            problemStatement={problemStatement}
            composedAt={composedAt}
            composedByModel={composedByModel}
            onOpenToolCall={(id) => setOpenToolCallId(id)}
          />
        ) : null}

        <InitiativesPreview
          initiatives={initiatives}
          incidentId={incident.incident_id}
          productId={incident.primary_product_id ?? null}
        />

        <ContributionsSection contributions={contributions} />

        <SimilarLessons lessons={lessons} />

        <div className="pt-4 border-t border-border flex items-center gap-3 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            {composedAt
              ? `AI report · composed ${new Date(composedAt).toLocaleString("de-DE", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}`
              : "AI report not yet composed"}
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={`/incident/${incident.incident_id}/8d`} />}
          >
            <FileText className="size-3.5" />
            View 8D report →
          </Button>
        </div>
      </div>

      <ToolCallDrawer
        toolCall={openToolCall}
        onClose={() => setOpenToolCallId(null)}
      />
      <HypothesisDetailPanel
        hypothesis={focusedHyp}
        primary={primary ?? null}
        claims={claims}
        toolCalls={toolCalls}
        onClose={() => setFocusedHypId(null)}
        onMakePrimary={(id) => setPrimaryId(id)}
        onOpenToolCall={(id) => setOpenToolCallId(id)}
      />
    </div>
  );
}
