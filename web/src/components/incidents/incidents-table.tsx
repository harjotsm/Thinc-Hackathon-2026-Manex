import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { IncidentListItem } from "@/server/incidents/loaders";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ARCHETYPE_BADGE: Record<string, string> = {
  supplier: "bg-orange-100 text-orange-800 border-orange-200",
  drift:    "bg-amber-100 text-amber-800 border-amber-200",
  design:   "bg-pink-100 text-pink-800 border-pink-200",
  operator: "bg-violet-100 text-violet-800 border-violet-200",
  unknown:  "bg-zinc-100 text-zinc-700 border-zinc-200",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "#fb923c",
  high:     "#fb923c",
  medium:   "#fcd34d",
  low:      "#86efac",
};
const dotColor = (sev: string | null | undefined): string =>
  (sev && SEVERITY_DOT[sev]) ?? "#cbd5e1";

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

const confidenceClass = (conf: number): string => {
  if (conf >= 80) return "text-emerald-700";
  if (conf >= 60) return "text-amber-700";
  return "text-muted-foreground";
};

type Props = { incidents: IncidentListItem[] };

/**
 * Sortable data Table for the /incidents page. Visually distinct from the
 * Inbox themes surface (which uses richer cluster cards) — here we lean
 * dense, scannable, and table-y.
 */
export const IncidentsTable = ({ incidents }: Props) => {
  return (
    <div className="px-6 py-5">
      <div
        data-testid="incidents-table-wrapper"
        className="overflow-hidden rounded-lg border border-border bg-card"
      >
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-8 pl-4" />
              <TableHead className="w-[88px] text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Archetype
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Incident
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Product
              </TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Signals
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Last activity
              </TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Confidence
              </TableHead>
              <TableHead className="w-8 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((incident) => {
              const archetype =
                incident.report_archetype ?? incident.archetype ?? "unknown";
              const archetypeBadge =
                ARCHETYPE_BADGE[archetype] ?? ARCHETYPE_BADGE.unknown;
              const conf =
                incident.confidence !== null
                  ? Math.round(incident.confidence * 100)
                  : null;

              return (
                <TableRow
                  key={incident.incident_id}
                  data-testid="incidents-table-row"
                  className="relative cursor-pointer group"
                >
                  <TableCell className="pl-4">
                    <span
                      aria-label={`Severity: ${incident.severity ?? "unknown"}`}
                      className="inline-block size-2 rounded-full"
                      style={{ background: dotColor(incident.severity) }}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "uppercase tracking-wider text-[10px] font-semibold rounded-md px-1.5",
                        archetypeBadge,
                      )}
                    >
                      {archetype}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-mono text-muted-foreground leading-tight">
                      {incident.incident_id}
                    </div>
                    <Link
                      href={`/incident/${incident.incident_id}`}
                      className="block text-sm font-semibold text-foreground leading-snug truncate max-w-[460px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm before:content-[''] before:absolute before:inset-0"
                    >
                      {incident.title ?? "Untitled incident"}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {incident.primary_product_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {incident.signal_count}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {timeAgo(incident.last_activity_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {conf !== null ? (
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums",
                          confidenceClass(conf),
                        )}
                      >
                        {conf}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    <ChevronRight
                      className="size-4 text-muted-foreground/60 group-hover:text-foreground transition-colors"
                      aria-hidden
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
