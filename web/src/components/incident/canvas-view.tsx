"use client";

import { useMemo, useState } from "react";
import type {
  ContributionRow,
  HypothesisView,
  IncidentRow,
  ReportArchetype,
  ReportInitiative,
  SignalRow,
} from "@/server/incident/loaders";
import { CanvasHeader } from "./canvas-header";
import { PrimaryHypothesisCard } from "./primary-hypothesis-card";
import { AlternativeHypotheses } from "./alternative-hypotheses";
import { InitiativesPreview } from "./initiatives-preview";
import { ContributionsSection } from "./contributions-section";
import { SimilarLessons, type LessonView } from "./similar-lessons";

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
}: Props) {
  // Default primary = the first hypothesis (rank 1).
  const [primaryId, setPrimaryId] = useState<string>(hypotheses[0]?.id ?? "");

  const primary = useMemo(
    () => hypotheses.find((h) => h.id === primaryId) ?? hypotheses[0],
    [hypotheses, primaryId],
  );

  const lastActivity = useMemo(
    () => lastActivityFromBundle(signals, contributions) ?? composedAt,
    [signals, contributions, composedAt],
  );

  // "Real" contributions = source !== "system" (or any human-authored)
  const realContribs = contributions.filter(
    (c) => c.source && c.source !== "system" && c.status !== "dismissed",
  );

  return (
    <div data-testid="canvas-view" style={{ display: "flex", flexDirection: "column" }}>
      <CanvasHeader
        incident={incident}
        signalCount={signals.length}
        contributionCount={contributions.length}
        initiativeCount={initiatives.length}
        hasPrimaryHypothesis={!!primary}
        hasEvidenceTrail={(primary?.supportingEvidence.length ?? 0) > 0}
        hasRealContributions={realContribs.length > 0}
        // We don't track per-initiative dispatch state on canvas; treat as
        // pending until the Initiatives kanban is consulted.
        hasDispatchedInitiative={false}
        archetype={archetype}
        lastActivityAt={lastActivity}
      />

      <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        {primary ? (
          <PrimaryHypothesisCard
            hypothesis={primary}
            problemStatement={problemStatement}
            signals={signals}
          />
        ) : (
          <div
            data-testid="no-hypothesis"
            style={{
              padding: "20px 22px",
              border: "1px dashed var(--line, #e2e8f0)",
              borderRadius: 10,
              background: "var(--bg-subtle, #f8fafc)",
              textAlign: "center",
              color: "var(--ink-muted, #64748b)",
              fontSize: 13,
            }}
          >
            ✦ AI couldn&apos;t identify a primary root cause yet. Try{" "}
            <span style={{ color: "var(--accent, #639fc4)", fontWeight: 600 }}>Run AI ↻</span> to
            re-investigate.
          </div>
        )}

        {hypotheses.length > 1 && primary ? (
          <AlternativeHypotheses
            hypotheses={hypotheses}
            primaryId={primary.id}
            onSelectPrimary={(id) => setPrimaryId(id)}
            incidentId={incident.incident_id}
          />
        ) : null}

        <InitiativesPreview
          initiatives={initiatives}
          incidentId={incident.incident_id}
          productId={incident.primary_product_id ?? null}
        />

        <ContributionsSection contributions={contributions} />

        <SimilarLessons lessons={lessons} />

        <div
          style={{
            marginTop: 24,
            paddingTop: 14,
            borderTop: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span className="muted tt" style={{ fontSize: 11 }}>
            {composedAt
              ? `AI report v${composedAt ? "current" : "?"} · composed ${new Date(composedAt).toLocaleString()}`
              : "AI report not yet composed"}
          </span>
          <div className="spacer" style={{ flex: 1 }} />
          <a
            href={`/incident/${incident.incident_id}/8d`}
            className="btn ghost sm"
            style={{ textDecoration: "none" }}
          >
            View 8D report →
          </a>
        </div>
      </div>
    </div>
  );
}
