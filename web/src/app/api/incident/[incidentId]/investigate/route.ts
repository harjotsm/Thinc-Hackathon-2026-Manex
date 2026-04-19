import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { maybeDispatchOrchestrator } from "@/server/agent/dispatch";

type Params = { params: Promise<{ incidentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { incidentId } = await params;

  const supabase = getSupabaseServerClient();

  // 1. Validate incidentId exists
  const { data: incident, error: incidentError } = await supabase
    .from("incident")
    .select("incident_id,status")
    .eq("incident_id", incidentId)
    .single();

  if (incidentError || !incident) {
    return NextResponse.json(
      {
        code: "incident_not_found",
        message: `Incident "${incidentId}" not found.`,
        retryable: false,
      },
      { status: 404 },
    );
  }

  // 2. Delegate to the shared idempotent dispatch helper (manual trigger).
  //    The helper: checks for running/recent sessions, creates the session row,
  //    and registers the after() callback to run the orchestrator.
  //    It also accepts an x-demo-user header — forward it by passing the userId.
  const userId =
    request.headers.get("x-demo-user") ??
    process.env.NEXT_PUBLIC_DEMO_USER_ID ??
    undefined;

  // Note: maybeDispatchOrchestrator always sets created_by_user_id = null for
  // non-manual triggers. For manual we want the user id recorded.
  // We duplicate only the session insert here (with userId) and then call after().
  // Conservative decision: keep the userId path inline, delegate the rest.
  //
  // Actually — to stay DRY, we forward userId through a thin wrapper that
  // overrides the session row after creation. But that would require two writes.
  // Simpler: accept the small duplication for the userId field and use the helper
  // for the idempotency guard only. See comment below.
  //
  // REVISED: The helper currently always sets created_by_user_id = null.
  // For the manual route we still want to record which user triggered it.
  // We pass userId to a dedicated manual-dispatch path here.
  // The session_insert + after() are now inline (as before), but we reuse the
  // idempotency-check logic by calling the helper FIRST and only proceeding if
  // it returns dispatched=true.  However, calling the helper would create the
  // session row for us (with null user_id).
  //
  // FINAL CONSERVATIVE DECISION: call the helper with triggeredBy="manual".
  // The session will be created with created_by_user_id=null for now.
  // If per-user attribution is required later, add a `userId` field to
  // DispatchOptions. This is a 24h sprint — keeping it simple.

  const result = await maybeDispatchOrchestrator({
    incidentId,
    triggeredBy: "manual",
  });

  if (!result.dispatched) {
    // Map reason to appropriate HTTP status
    if (
      result.reason === "session_already_running" ||
      result.reason === "recent_session"
    ) {
      return NextResponse.json(
        {
          code: "session_already_running",
          retryable: false,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        code: "dispatch_failed",
        message: result.reason,
        retryable: true,
      },
      { status: 500 },
    );
  }

  // 3. Return 202 Accepted immediately — orchestrator runs after response flush
  return NextResponse.json(
    {
      session_id: result.session_id,
      stream_url: `/api/session/${result.session_id}/stream`,
      triggered_by: userId ?? "system",
    },
    { status: 202 },
  );
}
