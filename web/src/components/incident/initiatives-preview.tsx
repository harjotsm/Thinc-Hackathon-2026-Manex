"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReportInitiative } from "@/server/incident/loaders";

type Props = {
  initiatives: ReportInitiative[];
  incidentId: string;
};

const DOMAIN_TINT: Record<string, { bg: string; fg: string }> = {
  production: { bg: "#dbeafe", fg: "#1e40af" },
  supplier: { bg: "#fed7aa", fg: "#9a3412" },
  rnd: { bg: "#fce7f3", fg: "#9d174d" },
};

const SYSTEM_LABEL: Record<string, string> = {
  mes: "MES",
  srm: "SRM",
  jira: "JIRA",
  erp: "ERP",
  crm: "CRM",
  manex: "Manex",
};

const formatTarget = (target: string): string => {
  const lower = target.toLowerCase().trim();
  for (const [k, v] of Object.entries(SYSTEM_LABEL)) {
    if (lower.includes(k)) return v;
  }
  return target;
};

export function InitiativesPreview({ initiatives, incidentId }: Props) {
  const [approved, setApproved] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(initiatives.map((_, i) => [i, true])),
  );

  const approvedCount = useMemo(
    () => Object.values(approved).filter(Boolean).length,
    [approved],
  );

  if (initiatives.length === 0) {
    return (
      <section
        data-testid="initiatives-preview-empty"
        style={{
          marginTop: 18,
          padding: "20px 22px",
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
            marginBottom: 6,
          }}
        >
          Suggested initiatives
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--ink-muted, #64748b)",
          }}
        >
          ✦ AI will propose initiatives once reasoning completes.
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="initiatives-preview"
      style={{ marginTop: 18 }}
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
            fontWeight: 700,
            color: "var(--accent, #639fc4)",
          }}
        >
          ✦ Suggested initiatives ({initiatives.length})
        </span>
        <span className="muted tt" style={{ fontSize: 11 }}>
          approve to dispatch
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {initiatives.map((init, i) => {
          const tint = DOMAIN_TINT[init.domain] ?? DOMAIN_TINT.production;
          const isApproved = approved[i] ?? false;
          return (
            <div
              key={`${init.title}-${i}`}
              data-testid={`initiative-card-${i}`}
              className="card"
              style={{
                padding: 14,
                border: isApproved
                  ? "1px solid var(--accent-ring, rgba(99,159,196,0.35))"
                  : "1px solid var(--line, #e2e8f0)",
                borderRadius: 10,
                background: "var(--bg-surface, white)",
                opacity: isApproved ? 1 : 0.65,
                transition: "all 180ms",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    background: tint.bg,
                    color: tint.fg,
                    padding: "2px 7px",
                    borderRadius: 3,
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {init.domain}
                </span>
                <span
                  className="mono tt"
                  style={{
                    fontSize: 10,
                    color: "var(--ink-muted, #64748b)",
                  }}
                >
                  → {formatTarget(init.target_system)}
                </span>
                <div className="spacer" style={{ flex: 1 }} />
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--accent, #639fc4)",
                    fontWeight: 600,
                  }}
                >
                  {Math.round(init.confidence * 100)}%
                </span>
              </div>

              <h4
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.35,
                  margin: 0,
                  color: "var(--ink-primary, #0f172a)",
                }}
              >
                {init.title}
              </h4>

              <p
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-secondary, #475569)",
                  lineHeight: 1.5,
                  margin: 0,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {init.rationale}
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 4,
                  fontSize: 11,
                  color: "var(--ink-muted, #64748b)",
                }}
              >
                <span className="muted tt">owner</span>
                <span style={{ color: "var(--ink-secondary, #334155)", fontWeight: 500 }}>
                  {init.owner_hint}
                </span>
                <div className="spacer" style={{ flex: 1 }} />
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isApproved}
                    onChange={(e) =>
                      setApproved((cur) => ({ ...cur, [i]: e.target.checked }))
                    }
                    aria-label={`Approve initiative ${init.title}`}
                  />
                  <span style={{ color: isApproved ? "var(--accent, #639fc4)" : "var(--ink-muted, #94a3b8)", fontWeight: 600 }}>
                    {isApproved ? "Approved" : "Skip"}
                  </span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span className="muted tt" style={{ fontSize: 11 }}>
          {approvedCount} of {initiatives.length} approved
        </span>
        <div className="spacer" style={{ flex: 1 }} />
        <Link
          href={`/initiatives?incident=${encodeURIComponent(incidentId)}`}
          className="btn ghost sm"
          style={{ textDecoration: "none" }}
        >
          Track in Kanban →
        </Link>
        <Link
          href={`/incident/${incidentId}/resolve`}
          className="btn primary sm"
          style={{ textDecoration: "none" }}
        >
          Dispatch selected ({approvedCount})
        </Link>
      </div>
    </section>
  );
}
