import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { aggregateThemes, AggregatorIncidentInput } from "@/server/themes/aggregate";
import { relatedSignatures } from "@/server/themes/related";
import { themeTitle } from "@/server/themes/title";
import { themeLensEnum } from "@/server/schemas/theme";

export const revalidate = 30;

// ─── Query schema ─────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  lens: themeLensEnum.default("engineer"),
  window: z.enum(["1d", "7d", "30d"]).default("7d"),
  archetype: z.string().optional(),
  product: z.string().optional(),
  severity: z.string().optional(),
});

// ─── Valid enum values for filtering ─────────────────────────────────────────

const VALID_ARCHETYPE = new Set(["supplier", "drift", "design", "operator", "unknown"]);
const VALID_SEVERITY = new Set(["low", "medium", "high", "critical"]);

// "process" is not a DB archetype_t value — floor shows operator + drift only.
const FLOOR_ARCHETYPES = ["operator", "drift"];

const parseCommaSep = (raw: string | undefined, valid: Set<string>): string[] | null => {
  if (!raw) return null;
  const values = raw.split(",").map((v) => v.trim()).filter(Boolean);
  if (values.some((v) => !valid.has(v))) return null;
  return values;
};

const windowDays = (w: "1d" | "7d" | "30d"): number =>
  w === "1d" ? 1 : w === "30d" ? 30 : 7;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Support both NextRequest (nextUrl) and plain Request (url) for testability
  const url = request.nextUrl ?? new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "invalid_query",
        message: "Invalid query parameters.",
        details: parsed.error.flatten(),
        retryable: false,
      },
      { status: 400 },
    );
  }

  const q = parsed.data;

  const archetypeFilter = parseCommaSep(q.archetype, VALID_ARCHETYPE);
  if (q.archetype !== undefined && archetypeFilter === null) {
    return NextResponse.json(
      {
        code: "invalid_query",
        message: `Invalid archetype value(s): "${q.archetype}". Must be one of: ${[...VALID_ARCHETYPE].join(", ")}.`,
        retryable: false,
      },
      { status: 400 },
    );
  }

  const severityFilter = parseCommaSep(q.severity, VALID_SEVERITY);
  if (q.severity !== undefined && severityFilter === null) {
    return NextResponse.json(
      {
        code: "invalid_query",
        message: `Invalid severity value(s): "${q.severity}". Must be one of: ${[...VALID_SEVERITY].join(", ")}.`,
        retryable: false,
      },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    const days = windowDays(q.window);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // DB column is "primary_part"; the app uses "primary_part_number" internally.
    const select =
      "incident_id,title,archetype,severity,last_activity_at,signal_count,primary_product_id,primary_part,centroid_embedding";

    let qb = supabase
      .from("incident")
      .select(select)
      .order("last_activity_at", { ascending: false })
      .gte("last_activity_at", since);

    const archFilter =
      archetypeFilter ?? (q.lens === "floor" ? FLOOR_ARCHETYPES : null);
    if (archFilter && archFilter.length > 0) qb = qb.in("archetype", archFilter);
    if (severityFilter && severityFilter.length > 0) qb = qb.in("severity", severityFilter);
    if (q.product) qb = qb.eq("primary_product_id", q.product);

    const { data, error } = await qb;

    if (error) {
      return NextResponse.json(
        { code: "db_error", message: error.message, retryable: true },
        { status: 500 },
      );
    }

    const incidentRows = (data ?? []) as Record<string, unknown>[];
    const incidentIds = incidentRows.map((r) => r.incident_id as string);

    // ─── Enrich with latest report per incident ─────────────────────────────
    // The orchestrator writes its classification to report.report_8d._archetype
    // and the post-Compose confidence to report.confidence. The incident row's
    // own archetype/severity are usually NULL because correlator-spawned
    // incidents don't get them backfilled. Read the report instead so themes
    // show real archetypes (supplier/drift/design/operator) rather than
    // "unknown" everywhere.
    type ReportEnrich = {
      archetype: AggregatorIncidentInput["archetype"] | null;
      confidence: number | null;
    };
    const reportByIncident = new Map<string, ReportEnrich>();

    if (incidentIds.length > 0) {
      const { data: reportRows, error: reportError } = await supabase
        .from("report")
        .select("incident_id,version,status,confidence,report_8d")
        .in("incident_id", incidentIds)
        .order("version", { ascending: false });

      if (reportError) {
        console.warn(
          `[themes] report enrichment failed: ${reportError.message}`,
        );
      } else {
        for (const r of (reportRows ?? []) as Record<string, unknown>[]) {
          const incId = r.incident_id as string;
          // Skip if we already kept a higher-version row (sorted desc above).
          // Prefer rows where status === "current" if present; otherwise the
          // first one we see (highest version) wins.
          const existing = reportByIncident.get(incId);
          const isCurrent = (r.status as string | null) === "current";
          if (existing && !isCurrent) continue;

          const raw8d = (r.report_8d ?? {}) as Record<string, unknown>;
          const archetypeRaw = raw8d._archetype;
          const validArchetypes = new Set([
            "supplier",
            "drift",
            "design",
            "operator",
            "unknown",
          ]);
          const archetype =
            typeof archetypeRaw === "string" && validArchetypes.has(archetypeRaw)
              ? (archetypeRaw as AggregatorIncidentInput["archetype"])
              : null;
          const confidence =
            typeof r.confidence === "number" ? (r.confidence as number) : null;
          reportByIncident.set(incId, { archetype, confidence });
        }
      }
    }

    // ─── Enrich with real signal counts via incident_signal join ────────────
    // The denormalized incident.signal_count column is often NULL/0. Compute
    // counts from the link table directly. Cheaper than nested PostgREST count
    // and works against any seed.
    const signalCountByIncident = new Map<string, number>();

    if (incidentIds.length > 0) {
      const { data: signalLinks, error: signalLinkError } = await supabase
        .from("incident_signal")
        .select("incident_id,signal_id")
        .in("incident_id", incidentIds);
      if (signalLinkError) {
        console.warn(
          `[themes] incident_signal count failed: ${signalLinkError.message}`,
        );
      } else {
        for (const link of (signalLinks ?? []) as { incident_id: string }[]) {
          signalCountByIncident.set(
            link.incident_id,
            (signalCountByIncident.get(link.incident_id) ?? 0) + 1,
          );
        }
      }
    }

    const incidents: AggregatorIncidentInput[] = incidentRows.map(
      (row: Record<string, unknown>) => {
        const incId = row.incident_id as string;
        const enrich = reportByIncident.get(incId);
        const enrichedArchetype =
          enrich?.archetype ??
          (row.archetype as AggregatorIncidentInput["archetype"] | null) ??
          "unknown";
        const realSignalCount =
          signalCountByIncident.get(incId) ?? Number(row.signal_count ?? 0);
        return {
          incident_id: incId,
          archetype: enrichedArchetype,
          primary_product_id: (row.primary_product_id as string | null) ?? null,
          // DB uses "primary_part"; map to the app-internal "primary_part_number"
          primary_part_number: (row.primary_part as string | null) ?? null,
          title: (row.title as string | null) ?? null,
          severity: (row.severity as string | null) ?? null,
          last_activity_at: (row.last_activity_at as string | null) ?? null,
          signal_count: realSignalCount,
          centroid_embedding: Array.isArray(row.centroid_embedding)
            ? (row.centroid_embedding as number[])
            : null,
          source_count: 0,
          confidence: enrich?.confidence ?? null,
        };
      },
    );

    // confidence_avg is averaged from per-incident report.confidence (Bug A
    // fix). When no incident has a report yet, it stays 0; the UI renders
    // 0 as "—".
    const themes = aggregateThemes(incidents);

    // LLM-title any theme where:
    //   (a) dominant_entity is null (no deterministic template data), OR
    //   (b) archetype === "unknown" (even with a dominant_entity — avoids "Unknown · PM-xxxxx" labels)
    await Promise.all(
      themes
        .filter((t) => t.archetype === "unknown" || t.dominant_entity === null)
        .map(async (t) => {
          const signalTexts = t.incidents
            .map((i) => i.title)
            .filter((s): s is string => Boolean(s));
          const r = await themeTitle({ archetype: t.archetype, dominantEntity: t.dominant_entity ?? null, signalTexts });
          t.title = r.title;
          t.title_source = r.source;
        }),
    );

    // Compute per-theme mean centroid for cross-theme similarity hint
    const centroidByGroup = new Map<string, number[][]>();
    for (const inc of incidents) {
      const sig = themes.find((t) =>
        t.incidents.some((ti) => ti.incident_id === inc.incident_id),
      )?.signature;
      if (!sig || !inc.centroid_embedding) continue;
      const arr = centroidByGroup.get(sig) ?? [];
      arr.push(inc.centroid_embedding);
      centroidByGroup.set(sig, arr);
    }

    const meanCentroid = (vecs: number[][]): number[] | null => {
      if (vecs.length === 0) return null;
      const dim = vecs[0].length;
      const out = new Array<number>(dim).fill(0);
      for (const v of vecs) for (let i = 0; i < dim; i++) out[i] += v[i];
      for (let i = 0; i < dim; i++) out[i] /= vecs.length;
      return out;
    };

    const related = relatedSignatures(
      themes.map((t) => ({
        signature: t.signature,
        centroid_embedding: meanCentroid(centroidByGroup.get(t.signature) ?? []),
        member_count: t.stats.n_incidents,
      })),
    );

    for (const t of themes) {
      t.related_signatures = related.get(t.signature) ?? [];
    }

    return NextResponse.json({
      themes,
      generated_at: new Date().toISOString(),
      window_days: days,
      lens: q.lens,
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: "unexpected_error",
        message: err instanceof Error ? err.message : "Unexpected error.",
        retryable: false,
      },
      { status: 500 },
    );
  }
}
