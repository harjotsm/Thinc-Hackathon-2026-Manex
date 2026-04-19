"use client";

import { useState } from "react";
import type { HypothesisView } from "@/server/incident/loaders";

export type GraphVariant = "radial" | "tree" | "stack";
type Variant = GraphVariant;

type Props = {
  hypotheses: HypothesisView[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  incidentId: string;
};

// ─── Shared inline node (hypothesis card) ─────────────────────────────────────

function HypNode({
  h,
  active,
  onClick,
}: {
  h: HypothesisView;
  active: boolean;
  onClick: () => void;
}) {
  const conf = Math.round(h.confidence * 100);
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      style={{
        background: "var(--bg-elevated, white)",
        border: active
          ? "1.5px solid var(--accent, #639fc4)"
          : "1.5px solid var(--line-hi, #cbd5e1)",
        borderRadius: 10,
        padding: "9px 11px",
        boxShadow: active
          ? "0 0 0 4px rgba(99,159,196,0.18), 0 0 30px rgba(99,159,196,0.20)"
          : "none",
        cursor: "pointer",
        transition: "all 200ms",
        overflow: "hidden",
      }}
    >
      <div
        className="eyebrow"
        style={{
          color: active ? "var(--accent, #639fc4)" : "var(--ink-muted, #64748b)",
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {h.archetypeHint ?? `Hypothesis ${h.rank}`}
      </div>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          margin: "3px 0 7px",
          lineHeight: 1.3,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
      >
        {h.title}
      </div>
      <div className="row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div
          style={{
            flex: 1,
            height: 5,
            background: "var(--bg-inset, #f1f5f9)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${conf}%`,
              height: "100%",
              background: active ? "var(--accent, #639fc4)" : "var(--ink-muted, #94a3b8)",
            }}
          />
        </div>
        <span
          className="mono tt"
          style={{
            color: active ? "var(--accent, #639fc4)" : "var(--ink-secondary, #475569)",
            fontWeight: 600,
            fontSize: 11,
          }}
        >
          {conf}%
        </span>
      </div>
      <div
        className="row muted tt"
        style={{
          marginTop: 5,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--ink-muted, #64748b)",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <span>
          ✓{h.supportingEvidence.length} · ✗{h.conflictingEvidence.length}
        </span>
        {h.isPrimary ? (
          <span style={{ color: "var(--accent, #639fc4)", flexShrink: 0, marginLeft: 6 }}>
            primary
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Variant renderers ────────────────────────────────────────────────────────

export function GraphRadial({
  hypotheses,
  activeId,
  onSelect,
  incidentId,
}: {
  hypotheses: HypothesisView[];
  activeId: string;
  onSelect: (id: string) => void;
  incidentId: string;
}) {
  // Split alternates around a center incident node.
  const half = Math.ceil(hypotheses.length / 2);
  const left = hypotheses.slice(0, half);
  const right = hypotheses.slice(half);
  const rows = Math.max(left.length, right.length, 1);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: 360,
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 130px minmax(0,1fr)",
        gridTemplateRows: `repeat(${rows}, auto)`,
        gap: "14px 18px",
        alignContent: "center",
        justifyContent: "center",
        padding: "20px 8px",
      }}
    >
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <line x1="38" y1="30" x2="50" y2="50" stroke="rgba(99,159,196,0.35)" strokeWidth="0.25" />
        <line x1="38" y1="70" x2="50" y2="50" stroke="rgba(99,159,196,0.35)" strokeWidth="0.25" />
        <line x1="62" y1="30" x2="50" y2="50" stroke="rgba(99,159,196,0.35)" strokeWidth="0.25" />
        <line x1="62" y1="70" x2="50" y2="50" stroke="rgba(99,159,196,0.35)" strokeWidth="0.25" />
      </svg>

      {left.map((h, i) => (
        <div
          key={h.id}
          style={{
            gridColumn: 1,
            gridRow: i + 1,
            justifySelf: "end",
            width: "100%",
            maxWidth: 220,
            zIndex: 1,
          }}
        >
          <HypNode h={h} active={h.id === activeId} onClick={() => onSelect(h.id)} />
        </div>
      ))}

      <div
        style={{
          gridColumn: 2,
          gridRow: `1 / span ${rows}`,
          justifySelf: "center",
          alignSelf: "center",
          width: 120,
          height: 86,
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "var(--bg-elevated, white)",
            border: "1.5px solid var(--accent, #639fc4)",
            borderRadius: 10,
            padding: 8,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            className="eyebrow"
            style={{ color: "var(--accent, #639fc4)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}
          >
            Incident
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, marginTop: 3 }}>
            {incidentId}
          </div>
          <div
            className="muted tt mono"
            style={{ marginTop: 2, color: "var(--ink-muted, #94a3b8)" }}
          >
            {hypotheses.length} hypotheses
          </div>
        </div>
      </div>

      {right.map((h, i) => (
        <div
          key={h.id}
          style={{
            gridColumn: 3,
            gridRow: i + 1,
            justifySelf: "start",
            width: "100%",
            maxWidth: 220,
            zIndex: 1,
          }}
        >
          <HypNode h={h} active={h.id === activeId} onClick={() => onSelect(h.id)} />
        </div>
      ))}
    </div>
  );
}

export function GraphTree({
  hypotheses,
  activeId,
  onSelect,
  incidentId,
}: {
  hypotheses: HypothesisView[];
  activeId: string;
  onSelect: (id: string) => void;
  incidentId: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: 480,
        display: "grid",
        gridTemplateColumns: "180px 80px minmax(0,1fr)",
        gridTemplateRows: `repeat(${hypotheses.length}, minmax(90px, 1fr))`,
        alignItems: "center",
        gap: "14px 0",
        padding: "20px 8px",
      }}
    >
      <svg
        style={{
          gridColumn: 2,
          gridRow: `1 / span ${hypotheses.length}`,
          width: "100%",
          height: "100%",
          alignSelf: "stretch",
          pointerEvents: "none",
        }}
        preserveAspectRatio="none"
        viewBox="0 0 80 100"
      >
        {hypotheses.map((_, index) => {
          const y = ((index + 0.5) / hypotheses.length) * 100;
          return (
            <path
              key={index}
              d={`M 0 50 C 40 50, 40 ${y}, 80 ${y}`}
              fill="none"
              stroke="rgba(99,159,196,0.5)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      <div
        style={{
          gridColumn: 1,
          gridRow: `1 / span ${hypotheses.length}`,
          justifySelf: "end",
          alignSelf: "center",
          width: 170,
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: "100%",
            background: "var(--bg-elevated, white)",
            border: "1.5px solid var(--accent, #639fc4)",
            borderRadius: 10,
            padding: 12,
          }}
        >
          <div
            className="eyebrow"
            style={{ color: "var(--accent, #639fc4)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}
          >
            Incident · root
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginTop: 4 }}>
            {incidentId}
          </div>
          <div className="muted tt mono" style={{ marginTop: 4, color: "var(--ink-muted, #94a3b8)" }}>
            {hypotheses.length} hypotheses
          </div>
        </div>
      </div>

      {hypotheses.map((h, i) => (
        <div
          key={h.id}
          style={{ gridColumn: 3, gridRow: i + 1, minWidth: 0, paddingLeft: 4, zIndex: 1 }}
        >
          <HypNode h={h} active={h.id === activeId} onClick={() => onSelect(h.id)} />
        </div>
      ))}
    </div>
  );
}

export function GraphStack({
  hypotheses,
  activeId,
  onSelect,
  incidentId,
}: {
  hypotheses: HypothesisView[];
  activeId: string;
  onSelect: (id: string) => void;
  incidentId: string;
}) {
  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        className="card"
        style={{
          padding: 12,
          border: "1.5px solid var(--accent, #639fc4)",
          borderRadius: 10,
          background: "var(--bg-elevated, white)",
        }}
      >
        <div className="eyebrow" style={{ color: "var(--accent, #639fc4)", fontSize: 10 }}>
          Incident · root
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{incidentId}</div>
      </div>
      {hypotheses.map((h) => (
        <div key={h.id} style={{ marginLeft: 24 }}>
          <HypNode h={h} active={h.id === activeId} onClick={() => onSelect(h.id)} />
        </div>
      ))}
    </div>
  );
}

// ─── Drawer chrome ────────────────────────────────────────────────────────────

export function ExploreGraphDrawer({
  hypotheses,
  activeId,
  onSelect,
  onClose,
  incidentId,
}: Props) {
  const [variant, setVariant] = useState<Variant>("radial");

  return (
    <div
      role="dialog"
      aria-label="Explore hypotheses graph"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        zIndex: 60,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100vw)",
          height: "100%",
          background: "var(--bg-surface, white)",
          borderLeft: "1px solid var(--line, #e2e8f0)",
          padding: 20,
          overflow: "auto",
          boxShadow: "-8px 0 32px -16px rgba(15,23,42,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--ink-primary, #0f172a)" }}>
            Explore hypotheses
          </h3>
          <span className="muted tt" style={{ color: "var(--ink-muted, #64748b)", fontSize: 11 }}>
            {hypotheses.length} hypothesis{hypotheses.length === 1 ? "" : "es"}
          </span>
          <div className="spacer" style={{ flex: 1 }} />
          <div
            className="var-tabs"
            style={{
              display: "flex",
              border: "1px solid var(--line, #e2e8f0)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {(["radial", "tree", "stack"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                style={{
                  background: v === variant ? "var(--accent, #639fc4)" : "var(--bg-surface, white)",
                  color: v === variant ? "white" : "var(--ink-secondary, #475569)",
                  border: "none",
                  padding: "5px 11px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn ghost sm"
            aria-label="Close graph drawer"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 10,
            background: "var(--bg-subtle, #f8fafc)",
            minHeight: 380,
          }}
        >
          {variant === "radial" ? (
            <GraphRadial
              hypotheses={hypotheses}
              activeId={activeId}
              onSelect={onSelect}
              incidentId={incidentId}
            />
          ) : variant === "tree" ? (
            <GraphTree
              hypotheses={hypotheses}
              activeId={activeId}
              onSelect={onSelect}
              incidentId={incidentId}
            />
          ) : (
            <GraphStack
              hypotheses={hypotheses}
              activeId={activeId}
              onSelect={onSelect}
              incidentId={incidentId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
