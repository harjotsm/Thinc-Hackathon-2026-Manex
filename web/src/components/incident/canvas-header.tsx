import Link from "next/link";
import type { IncidentRow, ReportArchetype } from "@/server/incident/loaders";
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

const ARCHETYPE_TINT: Record<string, { bg: string; fg: string }> = {
  supplier: { bg: "#fed7aa", fg: "#9a3412" },
  drift: { bg: "#fef3c7", fg: "#92400e" },
  design: { bg: "#fce7f3", fg: "#9d174d" },
  operator: { bg: "#ddd6fe", fg: "#5b21b6" },
  unknown: { bg: "#e2e8f0", fg: "#475569" },
};

const SEVERITY_TINT: Record<string, { bg: string; fg: string }> = {
  critical: { bg: "rgba(196, 68, 61, 0.10)", fg: "var(--sev-crit, #c4443d)" },
  high: { bg: "rgba(217, 114, 54, 0.10)", fg: "var(--sev-high, #d97236)" },
  medium: { bg: "rgba(217, 164, 32, 0.10)", fg: "#a17c16" },
  low: { bg: "rgba(95, 194, 163, 0.10)", fg: "var(--sev-low, #5fc2a3)" },
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
  const sev = SEVERITY_TINT[sevKey] ?? SEVERITY_TINT.medium;
  const arch = ARCHETYPE_TINT[archetype ?? "unknown"];

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
      style={{
        background: "var(--bg-surface, white)",
        borderBottom: "1px solid var(--line, #e2e8f0)",
        padding: "14px 24px 10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <Link
          href="/inbox"
          className="btn ghost sm"
          style={{ flexShrink: 0, textDecoration: "none", marginTop: 2 }}
        >
          ← Back
        </Link>

        <div style={{ flex: "1 1 360px", minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              className="chip"
              style={{
                background: sev.bg,
                color: sev.fg,
                borderColor: sev.fg,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontWeight: 600,
                padding: "2px 8px",
              }}
            >
              {sevKey}
            </span>
            {archetype ? (
              <span
                className="archetype-pill"
                style={{
                  background: arch.bg,
                  color: arch.fg,
                  padding: "3px 8px",
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {archetype}
              </span>
            ) : null}
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-primary, #0f172a)" }}>
              {incident.title ?? incident.incident_id}
            </span>
          </div>
          <div
            className="muted tt mono"
            style={{
              marginTop: 4,
              fontSize: 11,
              color: "var(--ink-muted, #64748b)",
            }}
          >
            {incident.incident_id} · {signalCount} signals · {contributionCount} contributions ·{" "}
            last activity {formatRelative(lastActivityAt)}
          </div>
        </div>

        <div className="spacer" style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          <RunAiButton incidentId={incident.incident_id} />
          <Link
            href={`/incident/${incident.incident_id}/resolve`}
            className="btn primary sm"
            style={{ textDecoration: "none" }}
          >
            Dispatch all →
          </Link>
        </div>
      </div>

      {/* Phase pills */}
      <div
        data-testid="phase-pills"
        style={{
          marginTop: 12,
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {phases.map((phase, i) => {
          const stateColor =
            phase.state === "done"
              ? { bg: "rgba(99,159,196,0.12)", fg: "var(--accent, #639fc4)", border: "var(--accent-ring, rgba(99,159,196,0.35))" }
              : phase.state === "current"
                ? { bg: "var(--accent, #639fc4)", fg: "#fff", border: "var(--accent, #639fc4)" }
                : { bg: "var(--bg-inset, #f1f5f9)", fg: "var(--ink-muted, #94a3b8)", border: "var(--line, #e2e8f0)" };
          return (
            <div key={phase.id} style={{ display: "flex", alignItems: "center" }}>
              <span
                data-testid={`phase-pill-${phase.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 9px",
                  borderRadius: 12,
                  background: stateColor.bg,
                  color: stateColor.fg,
                  border: `1px solid ${stateColor.border}`,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                {phase.state === "done" ? "✓" : phase.state === "current" ? "●" : "○"}{" "}
                {phase.label}
              </span>
              {i < phases.length - 1 ? (
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 1,
                    background: "var(--line, #e2e8f0)",
                    margin: "0 2px",
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
