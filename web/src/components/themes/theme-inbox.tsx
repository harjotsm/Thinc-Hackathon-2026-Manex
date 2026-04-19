"use client";
import { useState } from "react";
import type { Theme } from "@/server/schemas/theme";
import { ThemeCard } from "./theme-card";

type Props = { themes: Theme[] };

export const ThemeInbox = ({ themes }: Props) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (sig: string, target: Set<string>, set: (s: Set<string>) => void) => {
    const next = new Set(target);
    if (next.has(sig)) next.delete(sig); else next.add(sig);
    set(next);
  };

  const merged: Theme | null =
    selected.size >= 2
      ? (() => {
          const members = themes.filter((t) => selected.has(t.signature));
          return {
            ...members[0],
            signature: `merged:${members.map((m) => m.signature).join("+")}`,
            title: `Merged · ${members.map((m) => m.title).join(" + ")}`,
            incidents: members.flatMap((m) => m.incidents),
            stats: {
              n_incidents: members.reduce((a, m) => a + m.stats.n_incidents, 0),
              n_signals: members.reduce((a, m) => a + m.stats.n_signals, 0),
              n_sources: Math.max(...members.map((m) => m.stats.n_sources)),
              products: Array.from(new Set(members.flatMap((m) => m.stats.products))),
              lines: [],
            },
            related_signatures: [],
          };
        })()
      : null;

  return (
    <div style={{ padding: "20px 24px" }}>
      {selected.size >= 2 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 14px",
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: 6,
            marginBottom: 14,
            fontSize: 12,
            color: "#0c4a6e",
          }}
        >
          <strong>{selected.size} themes selected</strong>
          <span>· Preview-merged below (ephemeral, not persisted)</span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            style={{ marginLeft: "auto", background: "transparent", border: "1px solid #bae6fd", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
          >
            Clear
          </button>
        </div>
      ) : null}

      {merged ? <ThemeCard theme={merged} variant="expanded" /> : null}

      {themes.map((t) => (
        <div key={t.signature} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <button
            type="button"
            aria-label={`Select ${t.signature}`}
            onClick={() => toggle(t.signature, selected, setSelected)}
            style={{
              width: 24,
              alignSelf: "stretch",
              border: "1px solid #e2e8f0",
              background: selected.has(t.signature) ? "#1e40af" : "white",
              color: selected.has(t.signature) ? "white" : "#cbd5e1",
              borderRadius: 4,
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            {selected.has(t.signature) ? "✓" : ""}
          </button>
          <div style={{ flex: 1 }}>
            <ThemeCard theme={t} variant={expanded.has(t.signature) ? "expanded" : "compact"} />
          </div>
          <button
            type="button"
            aria-label={expanded.has(t.signature) ? `Collapse ${t.signature}` : `Expand ${t.signature}`}
            title={expanded.has(t.signature) ? "Collapse" : "Expand"}
            onClick={() => toggle(t.signature, expanded, setExpanded)}
            style={{
              alignSelf: "flex-start",
              marginTop: 14,
              width: 22,
              height: 22,
              border: "none",
              background: "transparent",
              borderRadius: 4,
              padding: 0,
              fontSize: 11,
              lineHeight: 1,
              color: "#94a3b8",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {expanded.has(t.signature) ? "▾" : "▸"}
          </button>
        </div>
      ))}
    </div>
  );
};
