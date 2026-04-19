"use client";

import { useMemo } from "react";
import type { HypothesisView } from "@/server/incident/loaders";
import { cn } from "@/lib/utils";

type Props = {
  hypotheses: HypothesisView[];
  problemStatement: string;
  activeId: string;
  onSelect: (id: string) => void;
};

// Quality-4M: map our archetype hint → standard Ishikawa branch label.
const BRANCH_MAP: Record<string, { label: string; side: "top" | "bottom"; tint: string }> = {
  Supplier: { label: "Material",   side: "top",    tint: "#f97316" },
  Process:  { label: "Method",     side: "bottom", tint: "#f59e0b" },
  Design:   { label: "Machine",    side: "top",    tint: "#ec4899" },
  Operator: { label: "Man",        side: "bottom", tint: "#8b5cf6" },
};

type Branch = {
  archetype: string;
  label: string;
  side: "top" | "bottom";
  tint: string;
  hypotheses: HypothesisView[];
};

export function IshikawaView({ hypotheses, problemStatement, activeId, onSelect }: Props) {
  const branches: Branch[] = useMemo(() => {
    const buckets = new Map<string, HypothesisView[]>();
    for (const h of hypotheses) {
      const key = h.archetypeHint ?? "Other";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(h);
    }
    const out: Branch[] = [];
    for (const [archetype, hs] of buckets) {
      const meta = BRANCH_MAP[archetype];
      if (!meta) continue;
      out.push({ archetype, ...meta, hypotheses: hs });
    }
    // Ensure all four canonical branches render even if empty — keeps the
    // fishbone recognisable rather than collapsing to a single spine.
    for (const [archetype, meta] of Object.entries(BRANCH_MAP)) {
      if (!out.find((b) => b.archetype === archetype)) {
        out.push({ archetype, ...meta, hypotheses: [] });
      }
    }
    return out;
  }, [hypotheses]);

  const topBranches = branches.filter((b) => b.side === "top");
  const bottomBranches = branches.filter((b) => b.side === "bottom");

  return (
    <div
      data-testid="ishikawa-view"
      className="relative w-full rounded-lg bg-muted/20 p-4"
    >
      {/* Spine + head */}
      <svg
        viewBox="0 0 1000 480"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-[420px]"
        aria-hidden
      >
        {/* main spine */}
        <line
          x1="40"
          y1="240"
          x2="820"
          y2="240"
          stroke="#94a3b8"
          strokeWidth="2"
        />
        {/* arrowhead into head */}
        <polygon points="820,232 840,240 820,248" fill="#94a3b8" />

        {/* Head (problem) */}
        <rect
          x="830"
          y="210"
          width="160"
          height="60"
          rx="8"
          ry="8"
          fill="#ffffff"
          stroke="#6366f1"
          strokeWidth="1.5"
        />
        <foreignObject x="834" y="214" width="152" height="52">
          <div
            className="h-full flex flex-col justify-center text-center px-1"
            style={{ color: "#0f172a" }}
          >
            <div
              className="text-[9px] uppercase tracking-wider font-semibold leading-none"
              style={{ color: "#6366f1" }}
            >
              Problem
            </div>
            <div
              className="text-[11px] leading-tight mt-1 line-clamp-3"
              style={{ color: "#0f172a" }}
            >
              {problemStatement}
            </div>
          </div>
        </foreignObject>

        {/* Top branches — diagonal lines sloping up from spine */}
        {topBranches.map((b, i) => {
          const xSpine = 140 + i * 220; // x where branch hits spine
          const xLabel = xSpine - 80; // branch label x (up-left of spine)
          const yLabel = 80;
          return (
            <g key={b.archetype}>
              <line
                x1={xSpine}
                y1="240"
                x2={xLabel}
                y2={yLabel + 10}
                stroke={b.tint}
                strokeWidth="2"
              />
              <rect
                x={xLabel - 60}
                y={yLabel - 18}
                width="120"
                height="28"
                rx="6"
                ry="6"
                fill={b.tint}
                opacity="0.12"
                stroke={b.tint}
                strokeWidth="1.5"
              />
              <text
                x={xLabel}
                y={yLabel + 1}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={b.tint}
                style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
              >
                {b.label}
              </text>
              <text
                x={xLabel}
                y={yLabel - 24}
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
              >
                ({b.archetype})
              </text>
            </g>
          );
        })}

        {/* Bottom branches — mirror top */}
        {bottomBranches.map((b, i) => {
          const xSpine = 220 + i * 220;
          const xLabel = xSpine - 80;
          const yLabel = 400;
          return (
            <g key={b.archetype}>
              <line
                x1={xSpine}
                y1="240"
                x2={xLabel}
                y2={yLabel - 10}
                stroke={b.tint}
                strokeWidth="2"
              />
              <rect
                x={xLabel - 60}
                y={yLabel - 10}
                width="120"
                height="28"
                rx="6"
                ry="6"
                fill={b.tint}
                opacity="0.12"
                stroke={b.tint}
                strokeWidth="1.5"
              />
              <text
                x={xLabel}
                y={yLabel + 8}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={b.tint}
                style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
              >
                {b.label}
              </text>
              <text
                x={xLabel}
                y={yLabel + 36}
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
              >
                ({b.archetype})
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hypothesis chips below the SVG, grouped by branch */}
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {branches.map((b) => (
          <div
            key={b.archetype}
            className="rounded-md border border-border/60 bg-card p-2"
          >
            <div
              className="text-[9px] uppercase tracking-wider font-bold mb-1"
              style={{ color: b.tint }}
            >
              {b.label} · {b.archetype}
            </div>
            {b.hypotheses.length === 0 ? (
              <div className="text-[10px] text-muted-foreground/60 italic">
                no hypothesis
              </div>
            ) : (
              <ul className="flex flex-col gap-1 m-0 p-0 list-none">
                {b.hypotheses.map((h) => {
                  const active = h.id === activeId;
                  return (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(h.id)}
                        className={cn(
                          "w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded border transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-transparent hover:bg-muted text-foreground/80",
                        )}
                      >
                        <span className="line-clamp-2">{h.title}</span>
                        <span className="font-mono text-[9px] text-muted-foreground/70">
                          {Math.round(h.confidence * 100)}%
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
