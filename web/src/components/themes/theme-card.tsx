import Link from "next/link";
import type { Theme } from "@/server/schemas/theme";
import { Spark } from "./spark";

const ARCHETYPE_TINT: Record<string, { bg: string; fg: string; border: string }> = {
  supplier: { bg: "#fed7aa", fg: "#9a3412", border: "#fed7aa" },
  drift:    { bg: "#fef3c7", fg: "#92400e", border: "#fef3c7" },
  design:   { bg: "#fce7f3", fg: "#9d174d", border: "#fce7f3" },
  operator: { bg: "#ddd6fe", fg: "#5b21b6", border: "#ddd6fe" },
  unknown:  { bg: "#e2e8f0", fg: "#475569", border: "#e2e8f0" },
};

type Props = { theme: Theme; variant?: "compact" | "expanded" };

export const ThemeCard = ({ theme, variant = "compact" }: Props) => {
  const tint = ARCHETYPE_TINT[theme.archetype] ?? ARCHETYPE_TINT.unknown;
  const conf = Math.round(theme.confidence_avg * 100);
  // Drill into the first member incident's canvas. The /incidents list view
  // is post-hackathon; canvas is the natural next surface for a clicked theme.
  const firstIncident = theme.incidents[0]?.incident_id;
  const drilldownHref = firstIncident ? `/incident/${firstIncident}` : "#";

  return (
    <Link
      href={drilldownHref}
      className="card"
      style={{
        display: "block",
        padding: "14px 16px",
        border: `1px solid ${tint.border}`,
        borderRadius: 8,
        textDecoration: "none",
        color: "inherit",
        background: "var(--surface, white)",
        marginBottom: 10,
      }}
    >
      <div className="row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          className="archetype-pill"
          style={{
            background: tint.bg,
            color: tint.fg,
            padding: "3px 8px",
            borderRadius: 3,
            fontSize: 10,
            fontWeight: 600,
            width: 80,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: ".05em",
          }}
        >
          {theme.archetype}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text, #0f172a)" }}>
            {theme.title}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted, #64748b)", marginTop: 2 }}>
            {theme.stats.products.join(", ") || "—"} · {theme.stats.n_incidents} incidents · {theme.stats.n_signals} signals
            {theme.related_signatures.length > 0 ? (
              <span style={{ marginLeft: 8, color: tint.fg }}>· Possibly related ({theme.related_signatures.length})</span>
            ) : null}
          </div>
        </div>
        <div style={{ width: 120, height: 6, background: tint.bg, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${conf}%`, height: "100%", background: tint.fg }} />
        </div>
        <span style={{ fontSize: 11, color: tint.fg, fontWeight: 600, width: 32, textAlign: "right" }}>
          {conf > 0 ? `${conf}%` : "—"}
        </span>
        <span aria-hidden style={{ color: "var(--muted, #94a3b8)", fontSize: 14 }}>→</span>
      </div>

      {variant === "expanded" ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {theme.incidents.map((i) => (
              <span
                key={i.incident_id}
                style={{
                  background: "var(--surface-muted, #f1f5f9)",
                  color: "var(--text, #334155)",
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                {i.incident_id} · {i.signal_count} sig
              </span>
            ))}
          </div>
          <Spark data={theme.signal_buckets_7d} color={tint.fg} fill height={28} />
        </div>
      ) : null}
    </Link>
  );
};
