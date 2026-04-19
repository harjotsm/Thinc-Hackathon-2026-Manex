import { notFound } from "next/navigation";
import {
  deriveHypotheses,
  getIncidentBundle,
  type ContributionRow,
  type ReportBundle,
} from "@/server/incident/loaders";
import { CanvasView } from "@/components/incident/canvas-view";
import type { LessonView } from "@/components/incident/similar-lessons";

export const revalidate = 30;

// ─── Empty state for "no report yet" ──────────────────────────────────────────

function PendingState({
  incidentId,
  reason,
  signalCount,
}: {
  incidentId: string;
  reason: "orchestrator-pending" | "report-malformed";
  signalCount: number;
}) {
  const isMalformed = reason === "report-malformed";
  return (
    <main
      style={{
        padding: "40px 24px",
        maxWidth: 720,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <div
        className="eyebrow"
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: "var(--ink-muted, #94a3b8)",
          marginBottom: 8,
        }}
      >
        {incidentId}
      </div>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          margin: "0 0 12px",
          color: "var(--ink-primary, #0f172a)",
        }}
      >
        {isMalformed
          ? "AI report needs to be re-composed"
          : "AI is still investigating this incident"}
      </h1>
      <p
        style={{
          fontSize: 13,
          color: "var(--ink-secondary, #475569)",
          lineHeight: 1.6,
          margin: "0 auto 22px",
          maxWidth: 480,
        }}
      >
        {isMalformed
          ? "The orchestrator wrote a report that doesn't match the expected shape. Run the orchestrator again to produce a fresh draft."
          : `${signalCount} signals captured. The orchestrator runs Classify → Investigate → Compose → Propose, then this page will populate with hypotheses and suggested initiatives.`}
      </p>
      <a
        href={`/api/incident/${incidentId}/investigate`}
        className="btn primary sm"
        style={{ textDecoration: "none", display: "inline-block" }}
      >
        Run AI ↻
      </a>
    </main>
  );
}

// ─── Helpers: extract lesson refs ────────────────────────────────────────────

const LESSON_RE = /\b(LES-[A-Z0-9-]+)\b/g;

const extractLessons = (
  report: ReportBundle | null,
  contributions: ContributionRow[],
): LessonView[] => {
  const found = new Map<string, number>(); // id → mention count

  const harvest = (text: string | null | undefined) => {
    if (!text) return;
    const matches = text.match(LESSON_RE);
    if (matches) {
      for (const m of matches) {
        found.set(m, (found.get(m) ?? 0) + 1);
      }
    }
  };

  if (report) {
    harvest(report.draft_8d.problem);
    for (const c of report.draft_8d.containment) harvest(c);
    for (const r of report.draft_8d.likely_root_causes) harvest(r);
    for (const e of report.draft_8d.evidence) harvest(e);
    for (const claim of report.draft_8d.claims) {
      harvest(claim.claim);
      for (const e of claim.evidence) harvest(e);
    }
    for (const init of report.initiatives) {
      harvest(init.title);
      harvest(init.rationale);
      for (const e of init.evidence) harvest(e);
    }
  }

  for (const c of contributions) {
    harvest(c.content);
    if (c.structured_payload) harvest(JSON.stringify(c.structured_payload));
  }

  return Array.from(found.entries()).map(([id, count]) => ({
    lesson_id: id,
    signature: id,
    applied_count: count,
    trend: "flat" as const,
  }));
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IncidentCanvasPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const bundle = await getIncidentBundle(incidentId);

  if (!bundle.incident) {
    notFound();
  }

  if (!bundle.report) {
    return (
      <PendingState
        incidentId={incidentId}
        reason={bundle.reportMissingReason === "report-malformed" ? "report-malformed" : "orchestrator-pending"}
        signalCount={bundle.signals.length}
      />
    );
  }

  const hypotheses = deriveHypotheses(bundle.report);
  const lessons = extractLessons(bundle.report, bundle.contributions);

  return (
    <CanvasView
      incident={bundle.incident}
      signals={bundle.signals}
      contributions={bundle.contributions}
      hypotheses={hypotheses}
      initiatives={bundle.report.initiatives}
      problemStatement={bundle.report.draft_8d.problem}
      archetype={bundle.report.archetype}
      lessons={lessons}
      composedAt={bundle.report.composed_at}
    />
  );
}
