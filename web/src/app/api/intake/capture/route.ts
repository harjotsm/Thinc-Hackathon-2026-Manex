import { NextResponse } from "next/server";
import { signalCaptureSchema } from "@/server/schemas/signal";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { createEmbedding, vectorLiteral } from "@/server/embeddings";
import { runCorrelator } from "@/server/correlator/run";

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = signalCaptureSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const signalId = makeId("SIG");
  const embedding = await createEmbedding(payload.text_payload ?? "");
  const supabase = getSupabaseServerClient();

  const insertPayload = {
    signal_id: signalId,
    signal_type: payload.signal_type,
    source_system: payload.source_system,
    captured_ts: payload.captured_ts ?? new Date().toISOString(),
    product_id: payload.product_id ?? null,
    part_number: payload.part_number ?? null,
    section_id: payload.section_id ?? null,
    batch_id: payload.batch_id ?? null,
    severity_hint: payload.severity_hint ?? 0.5,
    text_payload: payload.text_payload ?? null,
    raw_payload: payload.raw_payload ?? json,
    embedding: vectorLiteral(embedding),
  };

  const { data: signal, error } = await supabase
    .from("signal")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let correlatorResult: Awaited<ReturnType<typeof runCorrelator>> | null = null;
  if (payload.create_incident ?? true) {
    correlatorResult = await runCorrelator();
  }

  return NextResponse.json({
    signal,
    correlator: correlatorResult,
  });
}
