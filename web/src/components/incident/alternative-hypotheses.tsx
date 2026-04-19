"use client";

import { useState } from "react";
import type { HypothesisView } from "@/server/incident/loaders";
import { ExploreGraphDrawer } from "./explore-graph-drawer";

type Props = {
  hypotheses: HypothesisView[];
  primaryId: string;
  onSelectPrimary: (id: string) => void;
  incidentId: string;
};

const archetypeColor = (label: string | null) => {
  switch (label) {
    case "Supplier":
      return { bg: "#fed7aa", fg: "#9a3412" };
    case "Process":
      return { bg: "#fef3c7", fg: "#92400e" };
    case "Design":
      return { bg: "#fce7f3", fg: "#9d174d" };
    case "Operator":
      return { bg: "#ddd6fe", fg: "#5b21b6" };
    default:
      return { bg: "#e2e8f0", fg: "#475569" };
  }
};

export function AlternativeHypotheses({
  hypotheses,
  primaryId,
  onSelectPrimary,
  incidentId,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Show alternates: everything except the primary.
  const alternates = hypotheses.filter((h) => h.id !== primaryId);

  if (alternates.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="alternative-hypotheses"
      style={{
        marginTop: 16,
        padding: "12px 18px",
        background: "var(--bg-subtle, #f8fafc)",
        border: "1px solid var(--line, #e2e8f0)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          className="eyebrow"
          style={{
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--ink-muted, #64748b)",
          }}
        >
          Alternative hypotheses ({alternates.length})
        </span>
        <span className="muted tt" style={{ fontSize: 11 }}>
          click a chip to focus
        </span>
        <div className="spacer" style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="btn ghost sm"
          aria-label="Explore hypotheses as graph"
        >
          Explore as graph ↗
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {alternates.map((h) => {
          const conf = Math.round(h.confidence * 100);
          const tint = archetypeColor(h.archetypeHint);
          return (
            <button
              key={h.id}
              type="button"
              data-testid={`alternative-chip-${h.id}`}
              onClick={() => onSelectPrimary(h.id)}
              style={{
                background: "var(--bg-surface, white)",
                border: "1px solid var(--line, #e2e8f0)",
                borderRadius: 8,
                padding: "8px 12px",
                cursor: "pointer",
                opacity: 0.85,
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
                maxWidth: 280,
                fontSize: 12,
                color: "var(--ink-secondary, #334155)",
                transition: "opacity 150ms, border-color 150ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.borderColor = "var(--accent-ring, rgba(99,159,196,0.35))";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0.85";
                e.currentTarget.style.borderColor = "var(--line, #e2e8f0)";
              }}
            >
              {h.archetypeHint ? (
                <span
                  style={{
                    background: tint.bg,
                    color: tint.fg,
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    padding: "2px 6px",
                    borderRadius: 3,
                    flexShrink: 0,
                  }}
                >
                  {h.archetypeHint}
                </span>
              ) : null}
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {h.title}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-muted, #64748b)",
                  flexShrink: 0,
                }}
              >
                {conf}%
              </span>
            </button>
          );
        })}
      </div>

      {drawerOpen ? (
        <ExploreGraphDrawer
          hypotheses={hypotheses}
          activeId={primaryId}
          onSelect={(id) => onSelectPrimary(id)}
          onClose={() => setDrawerOpen(false)}
          incidentId={incidentId}
        />
      ) : null}
    </section>
  );
}
