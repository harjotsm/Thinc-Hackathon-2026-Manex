import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Theme } from "@/server/schemas/theme";
import { cn } from "@/lib/utils";
import {
  archetypeLabel,
  displayIncidentId,
  isUnknownArchetype,
} from "@/lib/display";
import { Card, CardContent } from "@/components/ui/card";
import { Spark } from "./spark";

// Stitch-skin: tint background (10% opacity of archetype hue) + indicator
// dot, mono small-caps label. The indicator dot is the only 100% opaque
// element — it's the "instrument" cue.
const ARCHETYPE_HEX: Record<string, string> = {
  supplier: "#f48a5c",
  drift:    "#f3c969",
  design:   "#f472b6",
  operator: "#a78bfa",
  unknown:  "#6b7080",
};

// Stitch severity dots — same hex as our existing palette.
const SEVERITY_DOT: Record<string, string> = {
  critical: "#eb5e55",
  high:     "#f48a5c",
  medium:   "#f3c969",
  low:      "#5fc2a3",
};

// Confidence colour bands for the big mono number.
const confidenceClass = (v: number | null | undefined): string => {
  if (v == null) return "text-muted-foreground";
  if (v >= 0.85) return "text-[color:var(--cta)]";
  if (v >= 0.6) return "text-[color:var(--amber)]";
  return "text-muted-foreground";
};

type Props = { theme: Theme; variant?: "compact" | "expanded" };

export const ThemeCard = ({ theme, variant = "compact" }: Props) => {
  const archetype = (theme.archetype ?? "unknown") as string;
  const archetypeHex = ARCHETYPE_HEX[archetype] ?? ARCHETYPE_HEX.unknown;
  const severityHex = SEVERITY_DOT[theme.severity_max ?? ""] ?? "#cbd5e1";
  const drilldownHref = `/incidents?theme=${theme.signature}`;

  const visibleIncidents = theme.incidents.slice(0, 3);
  const overflow = theme.incidents.length - visibleIncidents.length;
  const confidencePct =
    theme.confidence_avg != null ? Math.round(theme.confidence_avg * 100) : null;

  return (
    <Link
      href={drilldownHref}
      data-testid="theme-card"
      className="block group"
    >
      <Card
        size="sm"
        className={cn(
          "transition-all duration-150 py-3.5",
          "hover:shadow-md hover:ring-foreground/15",
        )}
        style={{
          // Stitch tint accent — left-border keyed by archetype, very subtle
          borderLeft: `3px solid ${archetypeHex}`,
        }}
      >
        <CardContent className="flex items-start gap-3 px-4">
          <span
            data-testid="severity-dot"
            aria-label={`Severity: ${theme.severity_max}`}
            title={`Severity: ${theme.severity_max}`}
            className="mt-1.5 inline-block size-2.5 shrink-0 rounded-full"
            style={{ background: severityHex }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <span
                data-testid="archetype-pill"
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
              <h3 className="text-sm font-semibold text-foreground leading-snug truncate flex-1 min-w-0">
                {theme.title}
              </h3>
            </div>

            <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
              <span className="font-mono">
                {theme.stats.products.join(", ") || "—"}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span>
                {theme.stats.n_incidents} incident{theme.stats.n_incidents === 1 ? "" : "s"}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span>{theme.stats.n_signals} signals</span>
              {theme.related_signatures.length > 0 ? (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-foreground/70">
                    Possibly related ({theme.related_signatures.length})
                  </span>
                </>
              ) : null}
            </div>

            {visibleIncidents.length > 0 ? (
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                {visibleIncidents.map((i) => (
                  <span
                    key={i.incident_id}
                    className="inline-flex items-center rounded-md border border-border/60 bg-background/40 px-1.5 h-5 text-[10px] font-mono font-medium text-muted-foreground"
                  >
                    {variant === "expanded"
                      ? `${i.incident_id} · ${i.signal_count} sig`
                      : displayIncidentId(i.incident_id)}
                  </span>
                ))}
                {overflow > 0 ? (
                  <span className="inline-flex items-center rounded-md border border-border/60 bg-background/40 px-1.5 h-5 text-[10px] font-medium text-muted-foreground">
                    +{overflow} more
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {theme.signal_buckets_7d.some((v) => v > 0) ? (
            <div className="hidden sm:block w-[120px] shrink-0 pt-1">
              <Spark
                data={theme.signal_buckets_7d}
                color={archetypeHex}
                variant="bars"
                height={32}
              />
              <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/70 font-mono">
                7d trend
              </div>
            </div>
          ) : null}

          {confidencePct != null ? (
            <div className="hidden md:flex flex-col items-end shrink-0 pl-1 pt-0.5">
              <span
                className={cn(
                  "font-mono text-xl font-bold leading-none tracking-tight",
                  confidenceClass(theme.confidence_avg),
                )}
              >
                {confidencePct}%
              </span>
              <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/70 font-mono">
                conf
              </span>
            </div>
          ) : null}

          <ChevronRight
            className="mt-1.5 size-4 text-muted-foreground/60 shrink-0 group-hover:text-foreground transition-colors"
            aria-hidden
          />
        </CardContent>
      </Card>
    </Link>
  );
};
