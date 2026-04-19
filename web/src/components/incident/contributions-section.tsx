"use client";

import { useState } from "react";
import type { ContributionRow } from "@/server/incident/loaders";

type Props = {
  contributions: ContributionRow[];
};

const DOMAIN_ICON: Record<string, string> = {
  central_quality: "◎",
  plant_quality_direct: "⌂",
  supplier_quality: "⇥",
  market_research: "◔",
  process_planner: "↳",
  rnd: "⚗",
  operator_rep: "◌",
  finance: "€",
  logistics: "□",
};

const STATUS_TINT: Record<string, { dot: string; label: string }> = {
  available: { dot: "var(--sev-low, #5fc2a3)", label: "Available" },
  live: { dot: "var(--accent, #639fc4)", label: "Live" },
  contributed: { dot: "var(--sev-low, #5fc2a3)", label: "Contributed" },
  pending: { dot: "var(--ink-muted, #94a3b8)", label: "Pending" },
  dismissed: { dot: "var(--ink-muted, #cbd5e1)", label: "Dismissed" },
};

const prettyDomain = (domain: string): string =>
  domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function ContributionsSection({ contributions }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (contributions.length === 0) {
    return (
      <section
        data-testid="contributions-empty"
        style={{
          marginTop: 18,
          padding: "14px 18px",
          border: "1px dashed var(--line, #e2e8f0)",
          borderRadius: 10,
          background: "var(--bg-subtle, #f8fafc)",
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
            marginBottom: 4,
          }}
        >
          Stakeholder contributions
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted, #64748b)" }}>
          No contributions yet. Domain agents will enrich context as they respond.
        </p>
      </section>
    );
  }

  const visible = showAll ? contributions : contributions.slice(0, 3);

  return (
    <section data-testid="contributions-section" style={{ marginTop: 18 }}>
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
          Stakeholder contributions ({contributions.length})
        </span>
        <div className="spacer" style={{ flex: 1 }} />
        {contributions.length > 3 ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="btn ghost sm"
            aria-expanded={showAll}
          >
            {showAll ? "Show top 3 ▴" : `Show all ${contributions.length} →`}
          </button>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((c) => {
          const status = STATUS_TINT[c.status ?? "available"] ?? STATUS_TINT.available;
          const icon = DOMAIN_ICON[c.domain] ?? "•";
          const summary =
            c.content ?? (c.structured_payload ? JSON.stringify(c.structured_payload) : "");
          const dismissed = c.status === "dismissed";
          return (
            <div
              key={c.contribution_id}
              data-testid={`contribution-${c.contribution_id}`}
              className="card"
              style={{
                padding: "10px 12px",
                border: "1px solid var(--line, #e2e8f0)",
                borderRadius: 8,
                background: "var(--bg-surface, white)",
                opacity: dismissed ? 0.45 : 1,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <span
                style={{
                  color: "var(--ink-muted, #64748b)",
                  fontSize: 14,
                  flexShrink: 0,
                  width: 18,
                  textAlign: "center",
                }}
                aria-hidden
              >
                {icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 3,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--ink-primary, #0f172a)",
                    }}
                  >
                    {prettyDomain(c.domain)}
                  </span>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: status.dot,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  <span className="muted tt mono" style={{ fontSize: 10 }}>
                    {status.label}
                  </span>
                  <div className="spacer" style={{ flex: 1 }} />
                  <span className="mono tt" style={{ fontSize: 10, color: "var(--ink-muted, #94a3b8)" }}>
                    {c.source}
                  </span>
                </div>
                {summary ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-secondary, #475569)",
                      lineHeight: 1.5,
                      overflowWrap: "anywhere",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textDecoration: dismissed ? "line-through" : "none",
                    }}
                  >
                    {summary}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
