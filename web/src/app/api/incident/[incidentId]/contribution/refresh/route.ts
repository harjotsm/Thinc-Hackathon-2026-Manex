import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { invokeTool } from "@/server/tools/registry";
import "@/server/tools/_register"; // side-effect registrations

type Params = { params: Promise<{ incidentId: string }> };

const CONTRIBUTION_TOOLS = [
  "contrib_central_quality",
  "contrib_plant_quality",
  "contrib_supplier_quality",
] as const;

// ─── POST — re-run the 3 functional contribution tools for the incident ────────

export async function POST(_: NextRequest, { params }: Params) {
  const { incidentId } = await params;

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

  // Fire all 3 contribution tools in parallel
  const results = await Promise.allSettled(
    CONTRIBUTION_TOOLS.map((name) =>
      invokeTool(name, { incident_id: incidentId }, { incident_id: incidentId }),
    ),
  );

  // Summarise outcomes
  const outcomes = CONTRIBUTION_TOOLS.map((name, i) => {
    const r = results[i];
    if (r.status === "fulfilled") {
      return { tool: name, ok: true, summary: r.value.summary };
    }
    return {
      tool: name,
      ok: false,
      error: (r.reason as Error)?.message ?? String(r.reason),
    };
  });

  const anyOk = outcomes.some((o) => o.ok);
  if (!anyOk) {
    return NextResponse.json(
      {
        code: "all_tools_failed",
        message: "All contribution tools failed.",
        outcomes,
        retryable: true,
      },
      { status: 500 },
    );
  }

  // Return updated contributions
  const { data: updatedRows, error: fetchErr } = await supabase
    .from("contribution")
    .select("contribution_id,domain,content,source,status,created_ts")
    .eq("incident_id", incidentId)
    .in(
      "domain",
      ["central_quality", "plant_quality_direct", "supplier_quality"],
    )
    .eq("source", "tool");

  if (fetchErr) {
    return NextResponse.json(
      { code: "db_error", message: fetchErr.message, retryable: true },
      { status: 500 },
    );
  }

  return NextResponse.json({
    incident_id: incidentId,
    outcomes,
    contributions: updatedRows ?? [],
  });
}
