import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Theme } from "@/server/schemas/theme";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spark } from "./spark";

// Archetype → tailwind classes for the badge. Restrained palette: every tint
// is a soft fill + readable foreground. Used via cn() so we don't fight base
// shadcn variants.
const ARCHETYPE_BADGE: Record<string, string> = {
  supplier: "bg-orange-100 text-orange-800 border-orange-200",
  drift:    "bg-amber-100 text-amber-800 border-amber-200",
  design:   "bg-pink-100 text-pink-800 border-pink-200",
  operator: "bg-violet-100 text-violet-800 border-violet-200",
  unknown:  "bg-zinc-100 text-zinc-700 border-zinc-200",
};

// Sparkline tint per archetype (hex — Spark expects a CSS color string).
const ARCHETYPE_SPARK: Record<string, string> = {
  supplier: "#c2410c",
  drift:    "#b45309",
  design:   "#be185d",
  operator: "#6d28d9",
  unknown:  "#475569",
};

// Severity dot color (warm hue for high/critical, kept consistent with the
// rest of the app — see `incident-row.tsx`).
const SEVERITY_DOT: Record<string, string> = {
  critical: "#fb923c",
  high:     "#fb923c",
  medium:   "#fcd34d",
  low:      "#86efac",
};
const dotColor = (sev: string | null | undefined): string =>
  (sev && SEVERITY_DOT[sev]) ?? "#cbd5e1";

// Truncate a long incident_id for chip display: "INC-9F62…A954" style.
const shortIncidentId = (id: string): string => {
  if (id.length <= 14) return id;
  // Keep the prefix recognisable + last 4 chars for disambiguation.
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
};

type Props = { theme: Theme; variant?: "compact" | "expanded" };

export const ThemeCard = ({ theme, variant = "compact" }: Props) => {
  const archetype = (theme.archetype ?? "unknown") as string;
  const archetypeBadge = ARCHETYPE_BADGE[archetype] ?? ARCHETYPE_BADGE.unknown;
  const sparkColor = ARCHETYPE_SPARK[archetype] ?? ARCHETYPE_SPARK.unknown;
  const conf = Math.round(theme.confidence_avg * 100);
  const drilldownHref = `/incidents?theme=${theme.signature}`;
  const showConfidence = conf >= 1;

  // Visible incident chips (cap at 3 to keep the row scannable).
  const visibleIncidents = theme.incidents.slice(0, 3);
  const overflow = theme.incidents.length - visibleIncidents.length;

  return (
    <Link
      href={drilldownHref}
      data-testid="theme-card"
      className="block group"
    >
      <Card
        size="sm"
        className={cn(
          "transition-all duration-150",
          "hover:border-primary/30 hover:shadow-sm hover:ring-foreground/15",
          "py-3",
        )}
      >
        <CardContent className="flex items-start gap-3 px-4">
          {/* Severity dot — bigger now (10px), aligned to title baseline */}
          <span
            data-testid="severity-dot"
            aria-label={`Severity: ${theme.severity_max}`}
            title={`Severity: ${theme.severity_max}`}
            className="mt-1.5 inline-block size-2.5 shrink-0 rounded-full"
            style={{ background: dotColor(theme.severity_max) }}
          />

          {/* Center: title + meta + chips */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <Badge
                data-testid="archetype-pill"
                className={cn(
                  "uppercase tracking-wider text-[10px] font-semibold rounded-md px-1.5",
                  archetypeBadge,
                )}
              >
                {archetype}
              </Badge>
              <h3 className="text-sm font-semibold text-foreground leading-snug truncate flex-1 min-w-0">
                {theme.title}
              </h3>
              {showConfidence ? (
                <Badge
                  variant="secondary"
                  data-testid="theme-confidence"
                  className="text-[10px] font-semibold tabular-nums shrink-0"
                >
                  {conf}%
                </Badge>
              ) : null}
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

            {/* Incident chips — surfaces the cluster nature */}
            {visibleIncidents.length > 0 ? (
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                {visibleIncidents.map((i) => (
                  <Badge
                    key={i.incident_id}
                    variant="outline"
                    className="text-[10px] font-mono font-medium px-1.5 py-0 h-5 text-muted-foreground"
                  >
                    {/* Existing test asserts the long form `INC-… · 8 sig`
                        when variant === "expanded". Render that for parity in
                        expanded mode; otherwise show truncated id chips. */}
                    {variant === "expanded"
                      ? `${i.incident_id} · ${i.signal_count} sig`
                      : shortIncidentId(i.incident_id)}
                  </Badge>
                ))}
                {overflow > 0 ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-medium px-1.5 py-0 h-5 text-muted-foreground"
                  >
                    +{overflow} more
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Right: 7-day sparkline — hidden when all-zero (flat line gives no signal) */}
          {theme.signal_buckets_7d.some((v) => v > 0) ? (
            <div className="hidden sm:block w-[140px] shrink-0 pt-1">
              <Spark
                data={theme.signal_buckets_7d}
                color={sparkColor}
                fill
                height={32}
              />
            </div>
          ) : null}

          {/* Drilldown affordance */}
          <ChevronRight
            className="mt-1.5 size-4 text-muted-foreground/60 shrink-0 group-hover:text-foreground transition-colors"
            aria-hidden
          />
        </CardContent>
      </Card>
    </Link>
  );
};
