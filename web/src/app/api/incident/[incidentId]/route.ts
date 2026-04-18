import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ incidentId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { incidentId } = await params;
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("incident")
    .select("incident_id,title,summary,severity,primary_product_id,status")
    .eq("incident_id", incidentId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ incident: data });
}
