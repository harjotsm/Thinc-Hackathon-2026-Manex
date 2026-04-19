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

// Severity dot color (Bug D). high/critical share the same warm hue so the
// dot reads as "needs attention" without splitting the palette further.
const SEVERITY_DOT: Record<string, string> = {
  critical: "#fb923c",
  high:     "#fb923c",
  medium:   "#fcd34d",
  low:      "#86efac",
};
const dotColor = (sev: string | null | undefined): string =>
  (sev && SEVERITY_DOT[sev]) ?? "#cbd5e1";

type Props = { theme: Theme; variant?: "compact" | "expanded" };

export const ThemeCard = ({ theme, variant = "compact" }: Props) => {
  const tint = ARCHETYPE_TINT[theme.archetype] ?? ARCHETYPE_TINT.unknown;
  const conf = Math.round(theme.confidence_avg * 100);
  // Drill into the /incidents list filtered by this theme's signature.
  const drilldownHref = `/incidents?theme=${theme.signature}`;
  // Hide the confidence bar when there's nothing useful to show AND the
  // severity dot already conveys urgency (high/critical/unknown). For
  // low/medium with conf=0 we still hide it — an empty bar always reads as
  // broken; the dot is enough.
  const showConfidenceBar = conf > 0;

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
          aria-label={`Severity: ${theme.severity_max}`}
          title={`Severity: ${theme.severity_max}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor(theme.severity_max),
            flexShrink: 0,
            display: "inline-block",
          }}
        />
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
        {showConfidenceBar ? (
          <>
            <div style={{ width: 120, height: 6, background: tint.bg, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${conf}%`, height: "100%", background: tint.fg }} />
            </div>
            <span style={{ fontSize: 11, color: tint.fg, fontWeight: 600, width: 32, textAlign: "right" }}>
              {conf}%
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: "var(--muted, #94a3b8)", fontWeight: 500, width: 32, textAlign: "right" }}>
            —
          </span>
        )}
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
