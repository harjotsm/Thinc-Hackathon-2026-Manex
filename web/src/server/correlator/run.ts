import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";

type SignalRecord = {
  signal_id: string;
  captured_ts: string;
  product_id: string | null;
  part_number: string | null;
  section_id: string | null;
  batch_id: string | null;
  severity_hint: number | null;
  text_payload: string | null;
};

const deterministicKey = (signal: SignalRecord) => {
  const day = signal.captured_ts.slice(0, 10);
  return [
    signal.product_id ?? "na",
    signal.part_number ?? "na",
    signal.batch_id ?? "na",
    signal.section_id ?? "na",
    day,
  ].join("|");
};

const inferSeverity = (signals: SignalRecord[]) => {
  const maxHint = signals.reduce((max, current) => Math.max(max, current.severity_hint ?? 0), 0);
  if (maxHint >= 0.8) return "critical";
  if (maxHint >= 0.6) return "high";
  if (maxHint >= 0.3) return "medium";
  return "low";
};

export const runCorrelator = async (): Promise<{ linkedSignals: number; incidentIds: string[] }> => {
  const supabase = getSupabaseServerClient();

  const { data: signals, error: signalError } = await supabase
    .from("signal")
    .select("signal_id,captured_ts,product_id,part_number,section_id,batch_id,severity_hint,text_payload")
    .order("captured_ts", { ascending: false })
    .limit(250);

  if (signalError) {
    throw new Error(`Failed to read signal rows: ${signalError.message}`);
  }

  const rawSignals = (signals ?? []) as SignalRecord[];
  if (rawSignals.length < 2) {
    return { linkedSignals: 0, incidentIds: [] };
  }

  const { data: existingLinks, error: existingLinksError } = await supabase
    .from("incident_signal")
    .select("signal_id");
  if (existingLinksError) {
    throw new Error(`Failed to read incident_signal links: ${existingLinksError.message}`);
  }
  const linkedIds = new Set((existingLinks ?? []).map((row) => String(row.signal_id)));
  const unlinked = rawSignals.filter((signal) => !linkedIds.has(signal.signal_id));

  const groups = new Map<string, SignalRecord[]>();
  for (const signal of unlinked) {
    const key = deterministicKey(signal);
    const bucket = groups.get(key) ?? [];
    bucket.push(signal);
    groups.set(key, bucket);
  }

  let linkedSignals = 0;
  const incidentIds: string[] = [];

  for (const [, group] of groups) {
    if (group.length < 2) {
      continue;
    }

    const incidentId = makeId("INC");
    const primary = group[0];
    const titlePart =
      primary.part_number ?? primary.batch_id ?? primary.product_id ?? "multi-source quality signal";
    const summary = `Auto-correlated ${group.length} signals around ${titlePart}.`;

    const { error: incidentError } = await supabase.from("incident").insert({
      incident_id: incidentId,
      status: "triage",
      title: `Correlated incident: ${titlePart}`,
      summary,
      severity: inferSeverity(group),
      primary_product_id: primary.product_id,
      primary_part: primary.part_number,
      hypothesis_tree: {
        branches: [
          { category: "Material", confidence: 0.35 },
          { category: "Process", confidence: 0.3 },
          { category: "Design", confidence: 0.2 },
          { category: "Operator", confidence: 0.15 },
        ],
      },
    });

    if (incidentError) {
      throw new Error(`Failed to create incident: ${incidentError.message}`);
    }

    const links = group.map((signal) => ({
      incident_id: incidentId,
      signal_id: signal.signal_id,
      added_by: "correlator",
    }));
    const { error: linkError } = await supabase.from("incident_signal").insert(links);
    if (linkError) {
      throw new Error(`Failed to write incident_signal links: ${linkError.message}`);
    }

    linkedSignals += group.length;
    incidentIds.push(incidentId);
  }

  return { linkedSignals, incidentIds };
};
