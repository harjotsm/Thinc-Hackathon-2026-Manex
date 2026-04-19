import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { IncidentListItem } from "@/server/incidents/loaders";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ─── Color palettes ─────────────────────────────────────────────────────────

const ARCHETYPE_BADGE: Record<string, string> = {
  supplier: "bg-orange-100 text-orange-800 border-orange-200",
  drift:    "bg-amber-100 text-amber-800 border-amber-200",
  design:   "bg-pink-100 text-pink-800 border-pink-200",
  operator: "bg-violet-100 text-violet-800 border-violet-200",
  unknown:  "bg-zinc-100 text-zinc-700 border-zinc-200",
};

// Severity dot color — kept as inline style so the test assertion
// `style.background === "rgb(251, 146, 60)"` continues to pass.
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

// ─── Component (kept as a plain row for legacy tests + non-table contexts) ─

type Props = { incident: IncidentListItem };

/**
 * Simple list-style row. The /incidents page now renders a sortable
 * Table via `IncidentsTable`; this component is kept for tests and
 * for any future non-table surfaces (cards on a dashboard, etc.).
 */
export const IncidentRow = ({ incident }: Props) => {
  const archetype = incident.report_archetype ?? incident.archetype ?? "unknown";
  const archetypeBadge = ARCHETYPE_BADGE[archetype] ?? ARCHETYPE_BADGE.unknown;
  const conf =
    incident.confidence !== null ? Math.round(incident.confidence * 100) : null;

  return (
    <Link
      href={`/incident/${incident.incident_id}`}
      data-testid="incident-row"
      className="block mb-2 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50 hover:border-primary/30"
    >
      <div className="flex items-center gap-3">
        <span
          data-testid="severity-dot"
          aria-label={`Severity: ${incident.severity ?? "unknown"}`}
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ background: dotColor(incident.severity) }}
        />

        <Badge
          data-testid="archetype-pill"
          className={cn(
            "uppercase tracking-wider text-[10px] font-semibold rounded-md px-1.5 shrink-0 w-[72px] justify-center",
            archetypeBadge,
          )}
        >
          {archetype}
        </Badge>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {incident.title ?? "Untitled incident"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-mono">{incident.incident_id}</span>
            {incident.primary_product_id ? (
              <>
                {" · "}
                <span className="font-mono">{incident.primary_product_id}</span>
              </>
            ) : null}
            {" · "}
            {incident.signal_count} signal{incident.signal_count !== 1 ? "s" : ""}
            {" · "}
            {timeAgo(incident.last_activity_at)}
          </div>
        </div>

        {conf !== null ? (
          <span
            data-testid="confidence"
            className="text-xs font-semibold tabular-nums text-primary shrink-0"
          >
            {conf}%
          </span>
        ) : (
          <span className="text-xs text-muted-foreground shrink-0">—</span>
        )}

        <ChevronRight
          className="size-4 text-muted-foreground/60 shrink-0"
          aria-hidden
        />
      </div>
    </Link>
  );
};
