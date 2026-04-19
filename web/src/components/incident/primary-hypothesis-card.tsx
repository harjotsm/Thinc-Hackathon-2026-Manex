"use client";

import { useMemo, useState } from "react";
import type { HypothesisView } from "@/server/incident/loaders";
import type { SignalRow } from "@/server/incident/loaders";

type Props = {
  hypothesis: HypothesisView;
  problemStatement: string;
  signals: SignalRow[];
  /**
   * If true, the evidence trail starts open. Per spec: default open if there
   * are >=3 supporting signals. The page composes this decision.
   */
  defaultEvidenceOpen?: boolean;
};

const confidenceTint = (conf: number): { bg: string; fg: string; bar: string; label: string } => {
  if (conf >= 0.8)
    return {
      bg: "rgba(95, 194, 163, 0.10)",
      fg: "var(--sev-low, #2f8a6f)",
      bar: "var(--sev-low, #2f8a6f)",
      label: "high confidence",
    };
  if (conf >= 0.6)
    return {
      bg: "rgba(217, 164, 32, 0.10)",
      fg: "#a17c16",
      bar: "#d9a420",
      label: "moderate confidence",
    };
  return {
    bg: "var(--bg-inset, #f1f5f9)",
    fg: "var(--ink-muted, #64748b)",
    bar: "var(--ink-muted, #94a3b8)",
    label: "low confidence",
  };
};

export function PrimaryHypothesisCard({
  hypothesis,
  problemStatement,
  signals,
  defaultEvidenceOpen,
}: Props) {
  const [trailOpen, setTrailOpen] = useState(
    defaultEvidenceOpen ?? hypothesis.supportingEvidence.length >= 3,
  );
  const [drawerSignal, setDrawerSignal] = useState<string | null>(null);

  const tint = confidenceTint(hypothesis.confidence);
  const conf = Math.round(hypothesis.confidence * 100);

  // Map evidence ids to signals; only signals (SIG-) lookup, others render plain.
  const signalById = useMemo(() => {
    const m = new Map<string, SignalRow>();
    for (const s of signals) m.set(s.signal_id, s);
    return m;
  }, [signals]);

  const focused = drawerSignal ? signalById.get(drawerSignal) ?? null : null;

  return (
    <div
      data-testid="primary-hypothesis-card"
      className="card"
      style={{
        padding: "20px 22px",
        border: "1.5px solid var(--accent-ring, rgba(99,159,196,0.35))",
        borderRadius: 12,
        background: "var(--bg-surface, white)",
        boxShadow: "0 1px 0 rgba(15,23,42,0.04), 0 12px 28px -16px rgba(99,159,196,0.32)",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
        {/* Big confidence badge */}
        <div
          data-testid="confidence-badge"
          style={{
            flexShrink: 0,
            width: 96,
            height: 96,
            borderRadius: 12,
            background: tint.bg,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: `1.5px solid ${tint.fg}`,
          }}
        >
          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: tint.fg,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {conf}
            <span style={{ fontSize: 14, marginLeft: 1 }}>%</span>
          </span>
          <span
            className="muted tt"
            style={{
              marginTop: 4,
              color: tint.fg,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontSize: 9,
            }}
          >
            confidence
          </span>
        </div>

        <div style={{ flex: "1 1 320px", minWidth: 240 }}>
          <div
            className="eyebrow"
            style={{
              color: "var(--accent, #639fc4)",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            ✦ Primary hypothesis
            {hypothesis.archetypeHint ? (
              <>
                <span style={{ margin: "0 6px", color: "var(--ink-muted, #94a3b8)" }}>·</span>
                <span style={{ color: "var(--ink-secondary, #475569)" }}>
                  {hypothesis.archetypeHint}
                </span>
              </>
            ) : null}
          </div>

          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              margin: "6px 0 8px",
              lineHeight: 1.3,
              color: "var(--ink-primary, #0f172a)",
            }}
          >
            {hypothesis.title}
          </h2>

          <p
            style={{
              fontSize: 13,
              color: "var(--ink-secondary, #475569)",
              lineHeight: 1.55,
              margin: "0 0 10px",
            }}
          >
            {problemStatement && problemStatement !== hypothesis.title
              ? problemStatement
              : hypothesis.oneLiner}
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              data-testid="evidence-count"
              className="mono tt"
              style={{ color: tint.fg, fontWeight: 600 }}
            >
              ✓ {hypothesis.supportingEvidence.length} supporting
            </span>
            <span className="mono tt muted">
              ✗ {hypothesis.conflictingEvidence.length} conflicting
            </span>
            <span className="muted tt">{tint.label}</span>
            <div className="spacer" style={{ flex: 1 }} />
            {hypothesis.supportingEvidence.length > 0 ? (
              <button
                type="button"
                onClick={() => setTrailOpen((v) => !v)}
                className="btn ghost sm"
                style={{ flexShrink: 0 }}
                aria-expanded={trailOpen}
                aria-controls="evidence-trail"
              >
                {trailOpen ? "Hide evidence trail ▴" : "Show evidence trail ▾"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Evidence trail */}
      {trailOpen && hypothesis.supportingEvidence.length > 0 ? (
        <div
          id="evidence-trail"
          data-testid="evidence-trail"
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid var(--line, #e2e8f0)",
          }}
        >
          <div
            className="eyebrow"
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: "var(--ink-muted, #64748b)",
              marginBottom: 8,
            }}
          >
            Evidence trail · {hypothesis.supportingEvidence.length} items
          </div>
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {hypothesis.supportingEvidence.slice(0, 8).map((evId, i) => {
              const sig = signalById.get(evId);
              const isSignal = !!sig;
              return (
                <li key={evId}>
                  <button
                    type="button"
                    disabled={!isSignal}
                    onClick={() => isSignal && setDrawerSignal(evId)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--line, #e2e8f0)",
                      background: "var(--bg-subtle, #f8fafc)",
                      cursor: isSignal ? "pointer" : "default",
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      fontSize: 12,
                      color: "var(--ink-secondary, #334155)",
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--accent, #639fc4)",
                        flexShrink: 0,
                        width: 18,
                        textAlign: "right",
                      }}
                    >
                      {i + 1}.
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--ink-muted, #64748b)",
                        flexShrink: 0,
                      }}
                    >
                      {evId}
                    </span>
                    {sig ? (
                      <>
                        <span style={{ color: "var(--ink-muted, #94a3b8)" }}>·</span>
                        <span
                          style={{
                            color: "var(--ink-muted, #64748b)",
                            fontSize: 11,
                            flexShrink: 0,
                          }}
                        >
                          {sig.source_system ?? sig.signal_type ?? "—"}
                        </span>
                        <span style={{ color: "var(--ink-muted, #94a3b8)" }}>·</span>
                        <span
                          style={{
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {sig.text_payload ?? "(no payload)"}
                        </span>
                        <span
                          aria-hidden
                          style={{ color: "var(--accent, #639fc4)", fontSize: 12 }}
                        >
                          →
                        </span>
                      </>
                    ) : (
                      <span style={{ color: "var(--ink-muted, #94a3b8)" }}>(reference)</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          {hypothesis.supportingEvidence.length > 8 ? (
            <div
              className="muted tt"
              style={{ marginTop: 8, fontSize: 11, color: "var(--ink-muted, #94a3b8)" }}
            >
              and {hypothesis.supportingEvidence.length - 8} more →
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Signal drawer (inline overlay — no portals) */}
      {focused ? (
        <div
          role="dialog"
          aria-label={`Signal ${focused.signal_id}`}
          onClick={() => setDrawerSignal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.35)",
            zIndex: 50,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 100vw)",
              height: "100%",
              background: "var(--bg-surface, white)",
              borderLeft: "1px solid var(--line, #e2e8f0)",
              padding: "20px 22px",
              overflow: "auto",
              boxShadow: "-8px 0 24px -12px rgba(15,23,42,0.18)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--accent, #639fc4)", fontWeight: 600 }}>
                {focused.signal_id}
              </span>
              <span style={{ color: "var(--ink-muted, #94a3b8)" }}>·</span>
              <span className="muted tt">
                {focused.source_system ?? "—"} · {focused.signal_type ?? "—"}
              </span>
              <div className="spacer" style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setDrawerSignal(null)}
                className="btn ghost sm"
                aria-label="Close signal drawer"
              >
                ✕
              </button>
            </div>

            <div className="muted tt mono" style={{ marginBottom: 14 }}>
              {focused.captured_ts ?? "(no timestamp)"}
            </div>

            <div
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--ink-primary, #0f172a)",
                whiteSpace: "pre-wrap",
                background: "var(--bg-subtle, #f8fafc)",
                border: "1px solid var(--line, #e2e8f0)",
                borderRadius: 8,
                padding: 14,
              }}
            >
              {focused.text_payload ?? "(empty payload)"}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
