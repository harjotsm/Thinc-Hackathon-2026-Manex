import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createEmbedding, vectorLiteral } from "@/server/embeddings";
import { makeId } from "@/server/utils/id";
import { runCorrelator } from "@/server/correlator/run";

const seedSchema = z.object({
  scenario: z.enum(["story1", "story3", "all"]).default("all"),
});

type SeedSignal = {
  signal_type: string;
  source_system: string;
  text_payload: string;
  product_id?: string;
  part_number?: string;
  batch_id?: string;
  section_id?: string;
  severity_hint: number;
  raw_payload: Record<string, unknown>;
};

const story1Signals: SeedSignal[] = [
  {
    signal_type: "incoming_inspection_alert",
    source_system: "supplier_quality",
    text_payload: "ESR_TEST near-limit spike linked to supplier batch SB-00007.",
    part_number: "PM-00008",
    batch_id: "SB-00007",
    severity_hint: 0.74,
    raw_payload: { story: "story1", channel: "inspection" },
  },
  {
    signal_type: "field_claim_cluster",
    source_system: "customer_claims",
    text_payload: "Totalausfall after few weeks; complaints reference PM-00008 and cold solder.",
    part_number: "PM-00008",
    batch_id: "SB-00007",
    severity_hint: 0.89,
    raw_payload: { story: "story1", channel: "field_claim" },
  },
];

const story3Signals: SeedSignal[] = [
  {
    signal_type: "field_claim_cluster",
    source_system: "customer_claims",
    text_payload: "Schleichender Ausfall with thermal drift around resistor R33 (PM-00015).",
    part_number: "PM-00015",
    severity_hint: 0.81,
    raw_payload: { story: "story3", channel: "field_claim" },
  },
  {
    signal_type: "telemetry_warning",
    source_system: "iot_telemetry",
    text_payload: "MC-200 devices show rising temperature variance before failure events.",
    part_number: "PM-00015",
    severity_hint: 0.63,
    raw_payload: { story: "story3", channel: "telemetry" },
  },
];

const seedLessons = async (incidentIds: string[]) => {
  if (incidentIds.length === 0) {
    return;
  }
  const supabase = getSupabaseServerClient();
  const lessonSeeds = [
    {
      lesson_id: makeId("LES"),
      incident_id: incidentIds[0],
      signature_text: "Supplier batch ESR drift causing solder cold joints",
      outcome: "effective",
      fix_summary: "Supplier screening + production containment reduced recurrence.",
    },
    {
      lesson_id: makeId("LES"),
      incident_id: incidentIds[incidentIds.length - 1],
      signature_text: "Thermal drift on resistor under long-duration load",
      outcome: "effective",
      fix_summary: "R&D tolerance update and FMEA control expansion.",
    },
  ];

  for (const lesson of lessonSeeds) {
    const embedding = await createEmbedding(lesson.signature_text);
    await supabase.from("lesson").insert({
      ...lesson,
      embedding: vectorLiteral(embedding),
    });
  }
};

const insertSignals = async (signals: SeedSignal[]) => {
  const supabase = getSupabaseServerClient();
  const inserted: string[] = [];
  const failures: Array<{ signal_id: string; reason: string }> = [];
  for (const signal of signals) {
    const signalId = makeId("SIG");
    const embedding = await createEmbedding(signal.text_payload);
    const { error } = await supabase.from("signal").insert({
      signal_id: signalId,
      signal_type: signal.signal_type,
      source_system: signal.source_system,
      captured_ts: new Date().toISOString(),
      product_id: signal.product_id ?? null,
      part_number: signal.part_number ?? null,
      section_id: signal.section_id ?? null,
      batch_id: signal.batch_id ?? null,
      severity_hint: signal.severity_hint,
      text_payload: signal.text_payload,
      raw_payload: signal.raw_payload,
      embedding: vectorLiteral(embedding),
    });

    if (error) {
      failures.push({ signal_id: signalId, reason: error.message });
      continue;
    }

    inserted.push(signalId);
  }

  return { inserted, failures };
};

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => ({}));
    const parsed = seedSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const scenario = parsed.data.scenario;
    const toInsert: SeedSignal[] = [];
    if (scenario === "story1" || scenario === "all") toInsert.push(...story1Signals);
    if (scenario === "story3" || scenario === "all") toInsert.push(...story3Signals);

    const { inserted: insertedSignalIds, failures } = await insertSignals(toInsert);
    const correlator = await runCorrelator();
    await seedLessons(correlator.incidentIds);

    return NextResponse.json({
      ok: true,
      scenario,
      insertedSignalIds,
      failures,
      correlator,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected seed error." },
      { status: 500 },
    );
  }
}
