import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { runOrchestratorWithSession } from "@/server/agent/orchestrator";

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

  // 2. Check for existing running session (unique partial index on session WHERE status='running')
  const { data: existingSession, error: sessionQueryError } = await supabase
    .from("session")
    .select("id")
    .eq("incident_id", incidentId)
    .eq("status", "running")
    .maybeSingle();

  if (sessionQueryError) {
    return NextResponse.json(
      {
        code: "db_error",
        message: sessionQueryError.message,
        retryable: true,
      },
      { status: 500 },
    );
  }

  if (existingSession) {
    return NextResponse.json(
      {
        code: "session_already_running",
        session_id: existingSession.id,
        retryable: false,
      },
      { status: 409 },
    );
  }

  // 3. Determine user id from header or env
  const createdByUserId =
    request.headers.get("x-demo-user") ??
    process.env.NEXT_PUBLIC_DEMO_USER_ID ??
    null;

  // 4. Create session row
  const sessionId = makeId("SES");
  const now = new Date().toISOString();

  const { error: insertError } = await supabase.from("session").insert({
    id: sessionId,
    incident_id: incidentId,
    phase: "classify",
    status: "running",
    started_at: now,
    created_by_user_id: createdByUserId,
  });

  if (insertError) {
    // Handle race condition — unique partial index violation means another session started concurrently
    if (
      insertError.message.toLowerCase().includes("unique") ||
      insertError.code === "23505"
    ) {
      // Re-query to get the racing session id
      const { data: racingSession } = await supabase
        .from("session")
        .select("id")
        .eq("incident_id", incidentId)
        .eq("status", "running")
        .maybeSingle();

      return NextResponse.json(
        {
          code: "session_already_running",
          session_id: racingSession?.id ?? null,
          retryable: false,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        code: "db_error",
        message: insertError.message,
        retryable: true,
      },
      { status: 500 },
    );
  }

  // 5. Fire the orchestrator after the response is sent.
  //    Using Next.js `after()` from next/server — runs after response is flushed,
  //    guaranteed by the framework even on Vercel serverless. Internally this
  //    calls runOrchestratorWithSession which handles its own error logging.
  const userId = createdByUserId ?? undefined;
  after(async () => {
    try {
      await runOrchestratorWithSession({
        session_id: sessionId,
        incident_id: incidentId,
        user_id: userId,
      });
    } catch (err) {
      // runOrchestratorWithSession already called updateSessionStatus(failed) +
      // logEvent(session_failed) internally, so we just surface the error here.
      console.error(`[investigate ${sessionId}] orchestrator failed:`, err);
    }
  });

  // 6. Return 202 Accepted immediately
  return NextResponse.json(
    {
      session_id: sessionId,
      stream_url: `/api/session/${sessionId}/stream`,
    },
    { status: 202 },
  );
}
