import { AlertCircle } from "lucide-react";
import { getIncidents } from "@/server/incidents/loaders";
import { IncidentsFilterStrip } from "@/components/incidents/incidents-filter-strip";
import { IncidentsTable } from "@/components/incidents/incidents-table";
import { ThemeBreadcrumb } from "@/components/incidents/theme-breadcrumb";

export const revalidate = 30;

type SearchParams = { [k: string]: string | string[] | undefined };

const parseList = (v: string | string[] | undefined): string[] | undefined => {
  if (typeof v !== "string" || v.length === 0) return undefined;
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const incidents = await getIncidents({
    windowDays:
      typeof sp.window_days === "string" ? parseInt(sp.window_days, 10) : 30,
    statuses: parseList(sp.status),
    archetypes: parseList(sp.archetype),
    severities: parseList(sp.severity),
    product: typeof sp.product === "string" ? sp.product : undefined,
    theme: typeof sp.theme === "string" ? sp.theme : undefined,
  });

  const themeParam = typeof sp.theme === "string" ? sp.theme : null;
  const lastSync = new Date().toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen">
      <header className="bg-card border-b border-border">
        <div className="px-6 py-4 flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Incidents
          </h1>
          <p className="text-xs text-muted-foreground">
            {incidents.length} incident{incidents.length === 1 ? "" : "s"} ·
            last sync {lastSync}
          </p>
        </div>
      </header>

      <IncidentsFilterStrip />

      {themeParam ? <ThemeBreadcrumb signature={themeParam} /> : null}

      {incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <AlertCircle size={20} />
          </div>
          <p className="text-sm font-medium text-foreground">No incidents</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No incidents match the current filter.
          </p>
        </div>
      ) : (
        <IncidentsTable incidents={incidents} />
      )}
    </div>
  );
}
