import { NextResponse } from "next/server";
import { signalCaptureResponseSchema, signalCaptureSchema } from "@/server/schemas/signal";
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

  const idempotencyKey = payload.idempotency_key ?? `auto-${crypto.randomUUID()}`;

  // Map source_system → signal_source enum (matches the migration backfill logic)
  const sourceEnumMap: Record<string, string> = {
    manex_defect: "backfill_defect",
    manex_field_claim: "backfill_field_claim",
    manex_test_result: "backfill_test_result",
    operator: "operator",
    engineer: "engineer",
    detector: "detector",
    customer_email: "customer_email",
  };
  const source = sourceEnumMap[payload.source_system] ?? "operator";

  const insertPayload = {
    signal_id: signalId,
    idempotency_key: idempotencyKey,
    signal_type: payload.signal_type,
    source,
    source_system: payload.source_system,
    captured_ts: payload.captured_ts ?? new Date().toISOString(),
    raw_text: payload.text_payload ?? "",
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

  const responsePayload = {
    signal,
    correlator: correlatorResult,
  };

  const validated = signalCaptureResponseSchema.safeParse(responsePayload);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Invalid capture response shape.", details: validated.error.flatten() },
      { status: 500 },
    );
  }

  return NextResponse.json(validated.data);
}
