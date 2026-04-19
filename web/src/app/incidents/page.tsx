import { getIncidents } from "@/server/incidents/loaders";
import { IncidentsFilterStrip } from "@/components/incidents/incidents-filter-strip";
import { IncidentRow } from "@/components/incidents/incident-row";
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

  return (
    <div style={{ background: "var(--bg, #fafbfc)", minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "14px 24px",
          borderBottom: "1px solid #f1f5f9",
          background: "white",
        }}
      >
        <span style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>
          Incidents
        </span>
        <span style={{ color: "#64748b", fontSize: 12 }}>
          {incidents.length} incidents · last sync{" "}
          {new Date().toLocaleTimeString()}
        </span>
      </header>

      <IncidentsFilterStrip />

      {themeParam ? <ThemeBreadcrumb signature={themeParam} /> : null}

      <div style={{ padding: "20px 24px" }}>
        {incidents.length === 0 ? (
          <div
            style={{
              margin: "60px auto",
              maxWidth: 360,
              textAlign: "center",
              color: "#64748b",
              fontSize: 13,
            }}
          >
            No incidents match the current filter.
          </div>
        ) : (
          incidents.map((i) => (
            <IncidentRow key={i.incident_id} incident={i} />
          ))
        )}
      </div>
    </div>
  );
}
