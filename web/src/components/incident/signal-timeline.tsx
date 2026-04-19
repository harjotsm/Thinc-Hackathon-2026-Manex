"use client";

import { useMemo } from "react";
import type { SignalRow } from "@/server/incident/loaders";
import { cn } from "@/lib/utils";

type Props = {
  signals: SignalRow[];
  /** ms window to render. Defaults to max(signal span, 6h). */
  minWindowMs?: number;
};

// Stable palette keyed by source_system → colour. Unknown sources fall back
// to a neutral muted dot so we never render an invisible signal.
const SOURCE_COLOR: Record<string, string> = {
  "ESR_TEST":          "#f97316",
  "ELEC_BASELINE":     "#f59e0b",
  "VIB_TEST":          "#eab308",
  "SPC-Drift":         "#ec4899",
  "Warranty":          "#ef4444",
  "Inbound-Inspection":"#8b5cf6",
  "MES":               "#3b82f6",
  "Floor":             "#10b981",
};

const colourFor = (src: string | null | undefined): string => {
  if (!src) return "#94a3b8";
  return SOURCE_COLOR[src] ?? "#64748b";
};

const formatShort = (iso: string, spanMs: number): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // For short spans (< 1d) show HH:MM; else dd.MM
  if (spanMs < 26 * 60 * 60 * 1000) {
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
};

export function SignalTimeline({ signals, minWindowMs = 6 * 60 * 60 * 1000 }: Props) {
  const points = useMemo(
    () =>
      signals
        .filter((s): s is SignalRow & { captured_ts: string } => !!s.captured_ts)
        .map((s) => ({
          signal: s,
          t: new Date(s.captured_ts as string).getTime(),
        }))
        .filter((p) => !Number.isNaN(p.t))
        .sort((a, b) => a.t - b.t),
    [signals],
  );

  if (points.length === 0) {
    return null;
  }

  const tMin = points[0].t;
  const tMaxRaw = points[points.length - 1].t;
  const span = Math.max(tMaxRaw - tMin, minWindowMs);
  const tMax = tMin + span;

  // Distinct source-systems in this incident, for the legend
  const sources = Array.from(
    new Set(points.map((p) => p.signal.source_system ?? "unknown")),
  );

  return (
    <section
      data-testid="signal-timeline"
      aria-label="Signal timeline"
      className="bg-card border-b border-border px-6 py-3"
    >
      <div className="max-w-[1100px] mx-auto w-full">
        <div className="flex items-baseline gap-3 flex-wrap mb-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Signal timeline
          </span>
          <span className="text-[11px] text-muted-foreground/70">
            {points.length} signal{points.length === 1 ? "" : "s"} · span{" "}
            {humanSpan(tMaxRaw - tMin)}
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-3 flex-wrap">
            {sources.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="inline-block size-1.5 rounded-full"
                  style={{ background: colourFor(s) }}
                />
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="relative h-8 rounded-md bg-muted/40 border border-border/60">
          {/* axis ticks (start, midpoint, end) */}
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/60 bg-card/80 px-1 rounded-sm">
            {formatShort(new Date(tMin).toISOString(), span)}
          </span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/60 bg-card/80 px-1 rounded-sm">
            {formatShort(new Date(tMax).toISOString(), span)}
          </span>

          {points.map((p) => {
            const pct = ((p.t - tMin) / span) * 100;
            const color = colourFor(p.signal.source_system);
            return (
              <span
                key={p.signal.signal_id}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 block size-2.5 rounded-full ring-2 ring-card",
                  "hover:scale-125 transition-transform",
                )}
                style={{ left: `${pct}%`, background: color }}
                title={`${p.signal.source_system ?? "unknown"} · ${p.signal.signal_type ?? ""} · ${formatShort(p.signal.captured_ts!, span)}`}
                aria-label={`signal ${p.signal.signal_id}`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function humanSpan(ms: number): string {
  if (ms < 60_000) return "< 1m";
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 24 * 60 * 60_000) return `${Math.round(ms / (60 * 60_000))}h`;
  return `${Math.round(ms / (24 * 60 * 60_000))}d`;
}
