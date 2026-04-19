import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// ─── Query schema ─────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  // Comma-separated enums
  status: z.string().optional(),
  severity: z.string().optional(),
  archetype: z.string().optional(),
  // Scalar filters
  product_id: z.string().optional(),
  window_days: z
    .string()
    .optional()
    .transform((v): number | undefined => {
      if (v === undefined) return undefined;
      const n = parseInt(v, 10);
      return isNaN(n) ? undefined : n;
    }),
  q: z.string().optional(),
  theme: z.string().optional(),
  since: z.string().optional(),
  // Pagination
  page: z
    .string()
    .optional()
    .transform((v): number => {
      if (v === undefined) return 1;
      const n = parseInt(v, 10);
      return isNaN(n) || n < 1 ? 1 : n;
    }),
  page_size: z
    .string()
    .optional()
    .transform((v): number => {
      if (v === undefined) return 20;
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1) return 20;
      if (n > 100) return 100;
      return n;
    }),
});

type ParsedQuery = z.output<typeof QuerySchema>;

// ─── Valid enum values for filtering ─────────────────────────────────────────

const VALID_STATUS = new Set([
  "triage",
  "reasoning",
  "resolving",
  "closed",
  "dismissed",
  "reopen",
]);
const VALID_SEVERITY = new Set(["low", "medium", "high", "critical"]);
const VALID_ARCHETYPE = new Set([
  "supplier",
  "drift",
  "design",
  "operator",
  "unknown",
]);

const parseCommaSep = (raw: string | undefined, valid: Set<string>): string[] | null => {
  if (!raw) return null;
  const values = raw.split(",").map((v) => v.trim()).filter(Boolean);
  const invalid = values.filter((v) => !valid.has(v));
  if (invalid.length > 0) return null; // signals validation error
  return values;
};

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

  const q: ParsedQuery = parsed.data;

  // Validate comma-sep enum fields
  const statusFilter = parseCommaSep(q.status, VALID_STATUS);
  if (q.status !== undefined && statusFilter === null) {
    return NextResponse.json(
      {
        code: "invalid_query",
        message: `Invalid status value(s): "${q.status}". Must be one of: ${[...VALID_STATUS].join(", ")}.`,
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

  // Parse ?theme=<archetype>:<entity> drilldown param
  let themeArchetype: string | null = null;
  let themeProduct: string | null = null;
  if (q.theme) {
    const sep = q.theme.indexOf(":");
    if (sep <= 0) {
      return NextResponse.json(
        { code: "invalid_query", message: `Invalid theme signature: "${q.theme}".`, retryable: false },
        { status: 400 },
      );
    }
    themeArchetype = q.theme.slice(0, sep);
    const entity = q.theme.slice(sep + 1);
    themeProduct = entity === "—" ? null : entity;
    if (!VALID_ARCHETYPE.has(themeArchetype)) {
      return NextResponse.json(
        { code: "invalid_query", message: `Invalid archetype in theme signature.`, retryable: false },
        { status: 400 },
      );
    }
  }

  try {
    const supabase = getSupabaseServerClient();

    const select =
      "incident_id,title,status,archetype,severity,signal_count,last_activity_at,primary_product_id";

    let query = supabase
      .from("incident")
      .select(select, { count: "exact" })
      .order("last_activity_at", { ascending: false });

    // Apply filters
    if (statusFilter && statusFilter.length > 0) {
      query = query.in("status", statusFilter);
    }
    if (severityFilter && severityFilter.length > 0) {
      query = query.in("severity", severityFilter);
    }
    if (archetypeFilter && archetypeFilter.length > 0) {
      query = query.in("archetype", archetypeFilter);
    }
    if (themeArchetype) {
      query = query.in("archetype", [themeArchetype]);
    }
    if (themeProduct) {
      query = query.eq("primary_product_id", themeProduct);
    }
    if (q.product_id) {
      query = query.eq("primary_product_id", q.product_id);
    }
    if (q.since) {
      query = query.gte("last_activity_at", q.since);
    }
    if (q.window_days !== undefined) {
      const windowStart = new Date(
        Date.now() - q.window_days * 24 * 60 * 60 * 1000,
      ).toISOString();
      query = query.gte("last_activity_at", windowStart);
    }
    if (q.q) {
      // Full-text search on title / summary — use ilike for broad match
      query = query.or(
        `title.ilike.%${q.q}%,summary.ilike.%${q.q}%`,
      );
    }

    // Pagination
    const page = q.page ?? 1;
    const pageSize = q.page_size ?? 20;
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        {
          code: "db_error",
          message: error.message,
          retryable: true,
        },
        { status: 500 },
      );
    }

    const total = count ?? 0;
    return NextResponse.json({
      data: data ?? [],
      pagination: {
        page,
        page_size: pageSize,
        total,
        has_next: offset + pageSize < total,
      },
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
