import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ incidentId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { incidentId } = await params;
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("report")
    .select(
      "id,incident_id,version,status,report_8d,composed_by_model,composed_at,confidence,session_id",
    )
    .eq("incident_id", incidentId)
    .eq("status", "current")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { code: "db_error", message: error.message },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { code: "not_found", message: "No current report for this incident." },
      { status: 404 },
    );
  }

  // report_8d contains the raw 8D fields plus optionally _initiatives/_tool_calls/_archetype
  // stored by the orchestrator after Propose phase completes.
  const raw = (data.report_8d ?? {}) as Record<string, unknown>;
  const { _initiatives, _tool_calls, _archetype, ...draft_8d } = raw;

  return NextResponse.json({
    report_id: data.id,
    incident_id: data.incident_id,
    session_id: data.session_id,
    version: data.version,
    composed_by_model: data.composed_by_model,
    composed_at: data.composed_at,
    confidence: data.confidence,
    // Core 8D fields
    draft_8d,
    archetype: _archetype ?? null,
    // Proposed initiatives (present after Propose phase patches the report)
    initiatives: (_initiatives as unknown[]) ?? [],
    tool_calls: (_tool_calls as unknown[]) ?? [],
  });
}
