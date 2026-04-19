import type { Theme } from "@/server/schemas/theme";
import { ThemeCard } from "./theme-card";
import { ChangedSinceYesterday } from "./changed-since-yesterday";

type Props = { themes: Theme[] };

const isUntriaged = (t: Theme): boolean =>
  !t.archetype || t.archetype === "unknown";

/**
 * Stitch-skin inbox: two-column layout.
 *  - Left (2/3 width): Triaged themes — sorted by severity (crit > high > med > low).
 *  - Right (1/3 width): Needs triage — still to be classified by the archetype
 *    pass.
 *
 * A "What changed since yesterday" strip sits at the top. If neither column
 * has content we render nothing (the parent handles the empty-state).
 */
const SEV_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const sevRank = (sev: string | null | undefined): number =>
  sev && sev in SEV_RANK ? SEV_RANK[sev] : 9;

export const ThemeInbox = ({ themes }: Props) => {
  const triaged = themes
    .filter((t) => !isUntriaged(t))
    .sort((a, b) => sevRank(a.severity_max) - sevRank(b.severity_max));
  const untriaged = themes.filter(isUntriaged);

  return (
    <>
      <ChangedSinceYesterday themes={themes} />

      <div className="px-6 py-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section
          data-testid="triaged-themes-section"
          className="lg:col-span-2 flex flex-col gap-2"
          aria-labelledby="triaged-themes-heading"
        >
          <header className="flex items-baseline gap-2 px-1">
            <h2
              id="triaged-themes-heading"
              className="text-sm font-bold tracking-tight text-foreground"
            >
              Triaged Themes
            </h2>
            <span className="text-xs text-muted-foreground">
              {triaged.length} cluster{triaged.length === 1 ? "" : "s"}
            </span>
          </header>

          {triaged.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-background/40 px-4 py-8 text-center text-xs text-muted-foreground">
              No triaged themes in this window yet.
            </div>
          ) : (
            triaged.map((t) => <ThemeCard key={t.signature} theme={t} />)
          )}
        </section>

        <section
          data-testid="needs-triage-section"
          className="flex flex-col gap-2"
          aria-labelledby="needs-triage-heading"
        >
          <header className="flex items-baseline gap-2 px-1">
            <h2
              id="needs-triage-heading"
              className="text-sm font-bold tracking-tight text-foreground"
            >
              Needs Triage
            </h2>
            <span className="text-xs text-muted-foreground">
              {untriaged.length} awaiting
            </span>
          </header>

          {untriaged.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-background/40 px-4 py-8 text-center text-xs text-muted-foreground">
              Everything classified.
            </div>
          ) : (
            untriaged.map((t) => <ThemeCard key={t.signature} theme={t} />)
          )}
        </section>
      </div>
    </>
  );
};
