import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// ─── Query schema ─────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  incident_id: z.string().optional(),
  status: z.string().optional(),
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

// ─── Valid status values ──────────────────────────────────────────────────────

const VALID_STATUS = new Set([
  "draft",
  "proposed",
  "approved",
  "dispatched",
  "failed",
  "done",
  "cancelled",
  "reopen",
  "rejected",
  "in_progress",
  "closed",
  "todo",
  "blocked",
  "verifying",
  "dismissed",
]);

const parseCommaSep = (
  raw: string | undefined,
  valid: Set<string>,
): string[] | null => {
  if (!raw) return null;
  const values = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const invalid = values.filter((v) => !valid.has(v));
  if (invalid.length > 0) return null;
  return values;
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
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

  try {
    const supabase = getSupabaseServerClient();

    const select =
      "initiative_id,incident_id,agent_domain,target_system,owner_user_id,due_ts,status,created_ts,closed_ts,product_action_id,external_ref";

    let query = supabase
      .from("initiative")
      .select(select, { count: "exact" })
      .order("created_ts", { ascending: false });

    if (q.incident_id) {
      query = query.eq("incident_id", q.incident_id);
    }
    if (statusFilter && statusFilter.length > 0) {
      query = query.in("status", statusFilter);
    }

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
