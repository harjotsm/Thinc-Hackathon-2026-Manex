import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "25");
  const source = searchParams.get("source_system");
  const productId = searchParams.get("product_id");

  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("signal")
    .select("signal_id,signal_type,source_system,captured_ts,product_id,part_number,batch_id,severity_hint,text_payload")
    .order("captured_ts", { ascending: false })
    .limit(Number.isNaN(limit) ? 25 : Math.max(1, Math.min(250, limit)));

  if (source) query = query.eq("source_system", source);
  if (productId) query = query.eq("product_id", productId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ signals: data ?? [] });
}
