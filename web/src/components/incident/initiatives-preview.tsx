"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReportInitiative } from "@/server/incident/loaders";

type Props = {
  initiatives: ReportInitiative[];
  incidentId: string;
  productId?: string | null;
};

type DispatchState = "idle" | "dispatching" | "done" | "error";

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

/** Map a ReportInitiative to the body expected by POST /api/initiative/approve */
function buildApprovePayload(init: ReportInitiative, incidentId: string, productId?: string | null) {
  // Derive agentDomain: must be one of the enum values
  const domainMap: Record<string, string> = {
    production: "production",
    supplier: "supplier",
    rnd: "rnd",
    logistics: "logistics",
    customer_response: "customer_response",
  };
  const agent_domain =
    domainMap[init.domain.toLowerCase()] ?? "production";

  // Build a closure_predicate in legacyClosurePredicateSchema shape
  const closure_predicate = init.closure_predicate ?? {
    type: "manual_confirmation",
    params: {},
  };

  return {
    incident_id: incidentId,
    agent_domain,
    target_system: init.target_system,
    comments: init.rationale,
    closure_predicate,
    status: "proposed",
    ...(productId && { product_id: productId }),
  };
}

export function InitiativesPreview({ initiatives, incidentId, productId }: Props) {
  const [approved, setApproved] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(initiatives.map((_, i) => [i, true])),
  );

  const [dispatchState, setDispatchState] = useState<DispatchState>("idle");
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);

  const approvedCount = useMemo(
    () => Object.values(approved).filter(Boolean).length,
    [approved],
  );

  const handleDispatch = async () => {
    if (dispatchState === "dispatching" || approvedCount === 0) return;

    const toDispatch = initiatives
      .map((init, i) => ({ init, i }))
      .filter(({ i }) => approved[i]);

    setDispatchState("dispatching");
    setDispatchError(null);

    try {
      let successCount = 0;
      for (const { init } of toDispatch) {
        const payload = buildApprovePayload(init, incidentId, productId);
        const res = await fetch("/api/initiative/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          successCount += 1;
        } else {
          let msg = `HTTP ${res.status}`;
          try {
            const body = await res.json();
            if (body?.error) msg = body.error;
          } catch {
            // ignore
          }
          throw new Error(msg);
        }
      }
      setCreatedCount(successCount);
      setDispatchState("done");
    } catch (err) {
      setDispatchState("error");
      setDispatchError(
        err instanceof Error ? err.message : "Dispatch failed",
      );
    }
  };

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

        {/* Dispatch success state */}
        {dispatchState === "done" && (
          <span
            data-testid="dispatch-success"
            style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}
          >
            ✓ {createdCount} initiative{createdCount === 1 ? "" : "s"} created
          </span>
        )}

        {/* Dispatch error state */}
        {dispatchState === "error" && dispatchError && (
          <span
            data-testid="dispatch-error"
            style={{ fontSize: 11, color: "#dc2626" }}
          >
            {dispatchError}
          </span>
        )}

        <div className="spacer" style={{ flex: 1 }} />

        {/* View kanban link — shown after success */}
        {dispatchState === "done" ? (
          <Link
            href={`/initiatives?incident=${encodeURIComponent(incidentId)}`}
            className="btn ghost sm"
            style={{ textDecoration: "none" }}
            data-testid="view-kanban-link"
          >
            View kanban →
          </Link>
        ) : (
          <Link
            href={`/initiatives?incident=${encodeURIComponent(incidentId)}`}
            className="btn ghost sm"
            style={{ textDecoration: "none" }}
          >
            Track in Kanban →
          </Link>
        )}

        <button
          type="button"
          data-testid="dispatch-button"
          className="btn primary sm"
          disabled={
            dispatchState === "dispatching" ||
            dispatchState === "done" ||
            approvedCount === 0
          }
          aria-busy={dispatchState === "dispatching"}
          onClick={handleDispatch}
          style={{ textDecoration: "none" }}
        >
          {dispatchState === "dispatching"
            ? "Dispatching…"
            : dispatchState === "done"
              ? "Dispatched ✓"
              : dispatchState === "error"
                ? "Retry dispatch"
                : `Dispatch selected (${approvedCount})`}
        </button>
      </div>
    </section>
  );
}
