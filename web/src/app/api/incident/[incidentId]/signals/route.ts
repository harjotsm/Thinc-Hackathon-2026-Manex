import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ incidentId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { incidentId } = await params;
  const supabase = getSupabaseServerClient();

  const { data: links, error: linkError } = await supabase
    .from("incident_signal")
    .select("signal_id")
    .eq("incident_id", incidentId);
  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  const signalIds = (links ?? []).map((row) => row.signal_id);
  if (signalIds.length === 0) {
    return NextResponse.json({ signals: [] });
  }

  const { data: signals, error: signalError } = await supabase
    .from("signal")
    .select("signal_id,signal_type,source_system,captured_ts,text_payload")
    .in("signal_id", signalIds)
    .order("captured_ts", { ascending: false });
  if (signalError) {
    return NextResponse.json({ error: signalError.message }, { status: 500 });
  }

  return NextResponse.json({ signals: signals ?? [] });
}
