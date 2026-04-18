"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Incident = {
  incident_id: string;
  title: string | null;
  status: string;
  archetype: string | null;
  severity: string | null;
  signal_count: number | null;
  last_activity_at: string | null;
  primary_product_id: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sevClass = (s: string | null): string => {
  switch (s) {
    case "critical": return "crit";
    case "high": return "high";
    case "medium": return "med";
    case "low": return "low";
    default: return "med";
  }
};

const statusClass = (s: string): string => {
  switch (s) {
    case "triage": return "triage";
    case "reasoning": return "reasoning";
    case "resolving": return "resolving";
    case "closed": return "closed";
    default: return "triage";
  }
};

const relativeTime = (ts: string | null): string => {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
};

// Inline sparkline SVG
const Spark = ({
  data,
  color = "var(--accent)",
  fill = false,
  height = 22,
}: {
  data: number[];
  color?: string;
  fill?: boolean;
  height?: number;
}) => {
  const max = Math.max(...data, 1);
  const pts = data.map(
    (v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 90 - 5}`,
  );
  return (
    <svg
      className="spark"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ height, display: "block", width: "100%" }}
    >
      {fill && (
        <polygon
          fill={color}
          opacity="0.18"
          points={`0,100 ${pts.join(" ")} 100,100`}
        />
      )}
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts.join(" ")} />
    </svg>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Metric counts
  const [openCount, setOpenCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(
          "/api/incidents?status=triage,reasoning&page_size=50&window_days=365",
        );
        if (!res.ok) {
          setError("Failed to load incidents.");
          setLoading(false);
          return;
        }
        const body = (await res.json()) as {
          data: Incident[];
          pagination: { total: number };
        };
        if (!active) return;
        setIncidents(body.data ?? []);
        setOpenCount(body.pagination.total ?? body.data.length);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const now = new Date().toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div style={{ padding: "20px 24px", fontFamily: "var(--sans)" }}>
      {/* Header row */}
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div className="eyebrow">Engineer lens · {now}</div>
          <h1
            style={{
              margin: "6px 0 0",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "var(--ink-primary)",
            }}
          >
            Needs your attention
          </h1>
        </div>
      </div>

      {/* Hero metric tiles */}
      <div
        className="panel"
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
          marginBottom: 16,
        }}
      >
        {/* Primary metric */}
        <div
          className="metric"
          style={{ borderRight: "1px solid var(--line)", padding: "22px 20px" }}
        >
          <span className="label">Open incidents</span>
          <span
            className="value accent"
            style={{ fontSize: 52, lineHeight: 1 }}
          >
            {openCount ?? incidents.length}
          </span>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="delta bad">Active</span>
            <Spark data={[1, 3, 2, 5, 7, 6, incidents.length || 4]} color="var(--cta)" fill height={28} />
          </div>
        </div>

        {/* Secondary tiles */}
        {[
          {
            label: "Open initiatives",
            value: "—",
            delta: "pending approval",
            cls: "neu",
            data: [2, 2, 3, 4, 5, 5, 6],
          },
          {
            label: "€ cost at risk",
            value: "—",
            delta: "signals pending",
            cls: "neu",
            data: [2, 3, 3, 5, 4, 6, 7],
          },
          {
            label: "Lessons applied",
            value: "—",
            delta: "network effect",
            cls: "good",
            data: [1, 2, 2, 3, 4, 4, 5],
          },
        ].map((m, i) => (
          <div
            key={i}
            className="metric"
            style={{ borderRight: i < 2 ? "1px solid var(--line)" : "none" }}
          >
            <span className="label">{m.label}</span>
            <span className="value">{m.value}</span>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className={`delta ${m.cls}`}>{m.delta}</span>
              <Spark data={m.data} color="var(--ink-muted)" height={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Incident list */}
      <div
        className="panel"
        style={{ padding: 16 }}
      >
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div className="eyebrow">Needs your attention</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2, color: "var(--ink-primary)" }}>
              Ranked by severity · {incidents.length} incident{incidents.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {loading && (
          <p style={{ fontSize: 13, color: "var(--ink-muted)", padding: "20px 0" }}>
            Loading incidents…
          </p>
        )}

        {error && !loading && (
          <p style={{ fontSize: 13, color: "var(--sev-crit)", padding: "20px 0" }}>{error}</p>
        )}

        {!loading && !error && incidents.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--ink-muted)", padding: "20px 0" }}>
            No open incidents found. Check back after running the backfill seed.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {incidents.map((inc) => (
            <Link
              key={inc.incident_id}
              href={`/investigate/${inc.incident_id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                className="card"
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  border: "1px solid var(--line)",
                  background: "var(--bg-surface)",
                  transition: "background 120ms",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "var(--accent-bg)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)";
                }}
              >
                <div className="row" style={{ gap: 12 }}>
                  <span className={`sev-dot ${sevClass(inc.severity)}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 10 }}>
                      <span
                        className="mono"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--ink-primary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {inc.incident_id}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-primary)" }}>
                        {inc.title ?? "(untitled)"}
                      </span>
                    </div>
                    <div
                      className="row muted tt"
                      style={{ gap: 10, marginTop: 3 }}
                    >
                      {inc.primary_product_id && <span>{inc.primary_product_id}</span>}
                      {inc.primary_product_id && <span>·</span>}
                      <span>{inc.signal_count ?? 0} signals</span>
                      <span>·</span>
                      <span>{relativeTime(inc.last_activity_at)}</span>
                      {inc.archetype && (
                        <>
                          <span>·</span>
                          <span style={{ textTransform: "capitalize" }}>{inc.archetype}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="col" style={{ alignItems: "flex-end", gap: 4 }}>
                    <span className={`status-chip ${statusClass(inc.status)}`}>{inc.status}</span>
                  </div>
                  <span
                    className="btn sm"
                    style={{ pointerEvents: "none" }}
                  >
                    Open →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
