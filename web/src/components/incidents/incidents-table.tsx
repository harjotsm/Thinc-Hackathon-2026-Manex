import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { IncidentListItem } from "@/server/incidents/loaders";
import { cn } from "@/lib/utils";
import {
  archetypeLabel,
  displayIncidentId,
  isUnknownArchetype,
  prettifyIncidentTitle,
} from "@/lib/display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Stitch palette — matches ThemeCard so the two surfaces share one visual
// language. Tint = ~10% alpha of the same hex; indicator dot is 100% opaque.
const ARCHETYPE_HEX: Record<string, string> = {
  supplier: "#f48a5c",
  drift:    "#f3c969",
  design:   "#f472b6",
  operator: "#a78bfa",
  unknown:  "#6b7080",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "#eb5e55",
  high:     "#f48a5c",
  medium:   "#f3c969",
  low:      "#5fc2a3",
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
  if (conf >= 80) return "text-[color:var(--cta)]";
  if (conf >= 60) return "text-[color:var(--amber)]";
  return "text-muted-foreground";
};

const ConfidenceBar = ({ conf }: { conf: number }) => {
  const pct = Math.max(2, Math.min(100, conf));
  const colour =
    conf >= 80
      ? "var(--cta)"
      : conf >= 60
        ? "var(--amber)"
        : "var(--ink-muted)";
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: colour }}
        />
      </div>
      <span
        className={cn(
          "text-xs font-mono font-bold tabular-nums shrink-0",
          confidenceClass(conf),
        )}
      >
        {conf}%
      </span>
    </div>
  );
};

type Props = { incidents: IncidentListItem[] };

export const IncidentsTable = ({ incidents }: Props) => {
  const withProduct = incidents.filter((i) => !!i.primary_product_id);
  const withoutProduct = incidents.filter((i) => !i.primary_product_id);

  return (
    <div className="px-6 py-5">
      <div
        data-testid="incidents-table-wrapper"
        className="overflow-hidden rounded-xl bg-card ring-1 ring-border/50 shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]"
      >
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b-border/50">
              <TableHead className="w-8 pl-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 font-bold">
                Sev
              </TableHead>
              <TableHead className="w-[100px] text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 font-bold">
                Archetype
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 font-bold">
                Incident
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 font-bold">
                Product
              </TableHead>
              <TableHead className="text-right text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 font-bold">
                Signals
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 font-bold">
                Last activity
              </TableHead>
              <TableHead className="text-right text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 font-bold">
                Confidence
              </TableHead>
              <TableHead className="w-8 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderIncidentRows(withProduct)}
            {withoutProduct.length > 0 ? (
              <>
                <TableRow
                  className="bg-muted/20 hover:bg-muted/20 border-y-border/50"
                  aria-hidden
                >
                  <TableCell
                    colSpan={8}
                    className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 font-bold"
                  >
                    No product assigned · {withoutProduct.length}
                  </TableCell>
                </TableRow>
                {renderIncidentRows(withoutProduct)}
              </>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const renderIncidentRows = (incidents: IncidentListItem[]) =>
  incidents.map((incident) => {
    const archetype =
      incident.report_archetype ?? incident.archetype ?? "unknown";
    const archetypeHex = ARCHETYPE_HEX[archetype] ?? ARCHETYPE_HEX.unknown;
    const conf =
      incident.confidence !== null
        ? Math.round(incident.confidence * 100)
        : null;
    const displayedTitle = incident.title
      ? prettifyIncidentTitle(incident.title, incident.incident_id)
      : "Untitled incident";

    return (
      <TableRow
        key={incident.incident_id}
        data-testid="incidents-table-row"
        className="relative cursor-pointer group border-b-border/40 hover:bg-muted/20"
      >
        <TableCell className="pl-4">
          <span
            aria-label={`Severity: ${incident.severity ?? "unknown"}`}
            className="inline-block size-2.5 rounded-full"
            style={{ background: dotColor(incident.severity) }}
          />
        </TableCell>
        <TableCell>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
              "font-mono text-[10px] font-bold uppercase tracking-wider",
              isUnknownArchetype(archetype) && "font-medium",
            )}
            style={{
              backgroundColor: `${archetypeHex}1a`,
              color: archetypeHex,
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: archetypeHex }}
              aria-hidden
            />
            {archetypeLabel(archetype)}
          </span>
        </TableCell>
        <TableCell>
          <div
            className="text-[10px] font-mono text-muted-foreground/80 leading-tight"
            title={incident.incident_id}
          >
            {displayIncidentId(incident.incident_id)}
          </div>
          <Link
            href={`/incident/${incident.incident_id}`}
            className="block text-sm font-semibold text-foreground leading-snug truncate max-w-[460px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm before:content-[''] before:absolute before:inset-0"
          >
            {displayedTitle}
          </Link>
        </TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">
          {incident.primary_product_id ?? (
            <span className="text-muted-foreground/50">—</span>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm font-mono font-semibold">
          {incident.signal_count}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {timeAgo(incident.last_activity_at)}
        </TableCell>
        <TableCell className="text-right">
          {conf !== null ? (
            <ConfidenceBar conf={conf} />
          ) : (
            <span className="text-xs text-muted-foreground/60">—</span>
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
  });
