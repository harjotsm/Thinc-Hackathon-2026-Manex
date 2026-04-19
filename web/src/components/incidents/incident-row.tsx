import Link from "next/link";
import type { IncidentListItem } from "@/server/incidents/loaders";

// ─── Color palettes (mirrored from theme-card.tsx) ───────────────────────────

const ARCHETYPE_TINT: Record<string, { bg: string; fg: string }> = {
  supplier: { bg: "#fed7aa", fg: "#9a3412" },
  drift:    { bg: "#fef3c7", fg: "#92400e" },
  design:   { bg: "#fce7f3", fg: "#9d174d" },
  operator: { bg: "#ddd6fe", fg: "#5b21b6" },
  unknown:  { bg: "#e2e8f0", fg: "#475569" },
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "#fb923c",
  high:     "#fb923c",
  medium:   "#fcd34d",
  low:      "#86efac",
};

const dotColor = (sev: string | null | undefined): string =>
  (sev && SEVERITY_DOT[sev]) ?? "#cbd5e1";

// ─── Relative time helper ─────────────────────────────────────────────────────

const timeAgo = (iso: string | null): string => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

// ─── Component ────────────────────────────────────────────────────────────────

type Props = { incident: IncidentListItem };

export const IncidentRow = ({ incident }: Props) => {
  // report_archetype overrides the DB column when present (same logic as themes)
  const archetype = incident.report_archetype ?? incident.archetype ?? "unknown";
  const tint = ARCHETYPE_TINT[archetype] ?? ARCHETYPE_TINT.unknown;
  const conf =
    incident.confidence !== null ? Math.round(incident.confidence * 100) : null;
  const shortId = incident.incident_id.replace(/^INC-/, "INC-").slice(0, 22);

  return (
    <Link
      href={`/incident/${incident.incident_id}`}
      data-testid="incident-row"
      style={{
        display: "block",
        padding: "12px 16px",
        border: "1px solid #f1f5f9",
        borderRadius: 8,
        textDecoration: "none",
        color: "inherit",
        background: "white",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Severity dot */}
        <span
          data-testid="severity-dot"
          aria-label={`Severity: ${incident.severity ?? "unknown"}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor(incident.severity),
            flexShrink: 0,
            display: "inline-block",
          }}
        />

        {/* Archetype pill */}
        <span
          data-testid="archetype-pill"
          style={{
            background: tint.bg,
            color: tint.fg,
            padding: "3px 8px",
            borderRadius: 3,
            fontSize: 10,
            fontWeight: 600,
            width: 72,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: ".05em",
            flexShrink: 0,
          }}
        >
          {archetype}
        </span>

        {/* Title + sub-meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {incident.title ?? "Untitled incident"}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {shortId}
            {incident.primary_product_id ? ` · ${incident.primary_product_id}` : ""}
            {" · "}
            {incident.signal_count} signal{incident.signal_count !== 1 ? "s" : ""}
            {" · "}
            {timeAgo(incident.last_activity_at)}
          </div>
        </div>

        {/* Confidence */}
        {conf !== null ? (
          <span
            data-testid="confidence"
            style={{
              fontSize: 11,
              color: tint.fg,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {conf}%
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>—</span>
        )}

        <span aria-hidden style={{ color: "#94a3b8", fontSize: 14 }}>→</span>
      </div>
    </Link>
  );
};
