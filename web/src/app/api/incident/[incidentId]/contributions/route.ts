import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";

type Params = { params: Promise<{ incidentId: string }> };

// ─── GET — return all contribution rows for the incident ──────────────────────

export async function GET(_: NextRequest, { params }: Params) {
  const { incidentId } = await params;
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("contribution")
    .select(
      "contribution_id,domain,content,structured_payload,source,status,weight,created_ts",
    )
    .eq("incident_id", incidentId)
    .order("created_ts", { ascending: true });

  if (error) {
    return NextResponse.json(
      { code: "db_error", message: error.message, retryable: true },
      { status: 500 },
    );
  }

  return NextResponse.json({ incident_id: incidentId, contributions: data ?? [] });
}

// ─── POST — add an engineer-authored contribution ─────────────────────────────

const ALLOWED_DOMAINS = [
  "central_quality",
  "plant_quality_direct",
  "supplier_quality",
  "market_research",
  "process_planner",
  "rnd",
  "operator_rep",
  "finance",
  "logistics",
] as const;

const PostBodySchema = z.object({
  domain: z.enum(ALLOWED_DOMAINS),
  content: z.string().min(1),
  structured_payload: z.unknown().optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const { incidentId } = await params;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "invalid_json", message: "Request body must be valid JSON.", retryable: false },
      { status: 400 },
    );
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "validation_error",
        message: parsed.error.issues.map((i) => i.message).join("; "),
        retryable: false,
      },
      { status: 400 },
    );
  }

  const authorUserId = request.headers.get("x-demo-user") ?? null;

  const supabase = getSupabaseServerClient();

  // Verify incident exists
  const { data: incident, error: incErr } = await supabase
    .from("incident")
    .select("incident_id")
    .eq("incident_id", incidentId)
    .single();

  if (incErr || !incident) {
    return NextResponse.json(
      {
        code: "incident_not_found",
        message: `Incident "${incidentId}" not found.`,
        retryable: false,
      },
      { status: 404 },
    );
  }

  const contributionId = makeId("CTB");

  const { data: created, error: insertErr } = await supabase
    .from("contribution")
    .insert({
      contribution_id: contributionId,
      incident_id: incidentId,
      domain: parsed.data.domain,
      content: parsed.data.content,
      structured_payload: parsed.data.structured_payload ?? null,
      source: "user",
      status: "available",
      author_user_id: authorUserId,
      weight: 1.0,
      created_ts: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json(
      { code: "db_error", message: insertErr.message, retryable: true },
      { status: 500 },
    );
  }

  return NextResponse.json({ contribution: created }, { status: 201 });
}
