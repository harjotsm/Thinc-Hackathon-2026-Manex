import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IncidentListItem = {
  incident_id: string;
  title: string | null;
  archetype: string | null;
  severity: string | null;
  primary_product_id: string | null;
  signal_count: number;
  last_activity_at: string | null;
  confidence: number | null;        // from latest report
  report_archetype: string | null;  // overrides incident.archetype if present
};

export type GetIncidentsParams = {
  windowDays?: number;
  statuses?: string[];
  archetypes?: string[];
  severities?: string[];
  product?: string;
  theme?: string;    // signature like "supplier:PM-00008"
  pageSize?: number;
};

// ─── Valid enum guards ─────────────────────────────────────────────────────────

const VALID_ARCHETYPE = new Set([
  "supplier",
  "drift",
  "design",
  "operator",
  "unknown",
]);

// ─── Loader ───────────────────────────────────────────────────────────────────

export const getIncidents = async (
  params: GetIncidentsParams = {},
): Promise<IncidentListItem[]> => {
  const {
    windowDays = 30,
    statuses,
    archetypes,
    severities,
    product,
    theme,
    pageSize = 200,
  } = params;

  // Parse theme → archetype + product_id
  let themeArchetype: string | null = null;
  let themeProduct: string | null = null;
  if (theme) {
    const sep = theme.indexOf(":");
    if (sep > 0) {
      const arch = theme.slice(0, sep);
      if (VALID_ARCHETYPE.has(arch)) {
        themeArchetype = arch;
        const entity = theme.slice(sep + 1);
        themeProduct = entity === "—" ? null : entity;
      }
    }
  }

  const supabase = getSupabaseServerClient();

  // ─── 1. Base incident query ────────────────────────────────────────────────
  const windowStart = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const select =
    "incident_id,title,archetype,severity,signal_count,last_activity_at,primary_product_id";

  let qb = supabase
    .from("incident")
    .select(select)
    .order("last_activity_at", { ascending: false })
    .gte("last_activity_at", windowStart)
    .range(0, Math.min(pageSize, 500) - 1);

  if (statuses && statuses.length > 0) qb = qb.in("status", statuses);
  if (archetypes && archetypes.length > 0) qb = qb.in("archetype", archetypes);
  if (severities && severities.length > 0) qb = qb.in("severity", severities);
  if (themeArchetype) qb = qb.in("archetype", [themeArchetype]);
  if (themeProduct) qb = qb.eq("primary_product_id", themeProduct);
  if (product) qb = qb.eq("primary_product_id", product);

  const { data, error } = await qb;

  if (error) {
    console.warn(`[incidents-loader] DB error: ${error.message}`);
    return [];
  }

  const incidentRows = (data ?? []) as Record<string, unknown>[];
  const incidentIds = incidentRows.map((r) => r.incident_id as string);

  if (incidentIds.length === 0) return [];

  // ─── 2. Latest report per incident (archetype + confidence) ───────────────
  type ReportEnrich = { archetype: string | null; confidence: number | null };
  const reportByIncident = new Map<string, ReportEnrich>();

  {
    const { data: reportRows, error: reportErr } = await supabase
      .from("report")
      .select("incident_id,version,status,confidence,report_8d")
      .in("incident_id", incidentIds)
      .order("version", { ascending: false });

    if (reportErr) {
      console.warn(`[incidents-loader] report enrichment failed: ${reportErr.message}`);
    } else {
      for (const r of (reportRows ?? []) as Record<string, unknown>[]) {
        const incId = r.incident_id as string;
        const existing = reportByIncident.get(incId);
        const isCurrent = (r.status as string | null) === "current";
        if (existing && !isCurrent) continue;

        const raw8d = (r.report_8d ?? {}) as Record<string, unknown>;
        const archetypeRaw = raw8d._archetype;
        const archetype =
          typeof archetypeRaw === "string" && VALID_ARCHETYPE.has(archetypeRaw)
            ? archetypeRaw
            : null;
        const confidence =
          typeof r.confidence === "number" ? (r.confidence as number) : null;

        reportByIncident.set(incId, { archetype, confidence });
      }
    }
  }

  // ─── 3. Real signal counts via incident_signal join ───────────────────────
  const signalCountByIncident = new Map<string, number>();

  {
    const { data: signalLinks, error: signalErr } = await supabase
      .from("incident_signal")
      .select("incident_id,signal_id")
      .in("incident_id", incidentIds);

    if (signalErr) {
      console.warn(`[incidents-loader] signal count failed: ${signalErr.message}`);
    } else {
      for (const link of (signalLinks ?? []) as { incident_id: string }[]) {
        signalCountByIncident.set(
          link.incident_id,
          (signalCountByIncident.get(link.incident_id) ?? 0) + 1,
        );
      }
    }
  }

  // ─── 4. Merge ─────────────────────────────────────────────────────────────
  return incidentRows.map((row) => {
    const incId = row.incident_id as string;
    const enrich = reportByIncident.get(incId);
    return {
      incident_id: incId,
      title: (row.title as string | null) ?? null,
      archetype: (row.archetype as string | null) ?? null,
      severity: (row.severity as string | null) ?? null,
      primary_product_id: (row.primary_product_id as string | null) ?? null,
      signal_count:
        signalCountByIncident.get(incId) ?? Number(row.signal_count ?? 0),
      last_activity_at: (row.last_activity_at as string | null) ?? null,
      confidence: enrich?.confidence ?? null,
      report_archetype: enrich?.archetype ?? null,
    };
  });
};
