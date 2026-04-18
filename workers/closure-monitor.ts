import { PostgrestClient } from "@supabase/postgrest-js";

type InitiativeRow = {
  initiative_id: string;
  incident_id: string;
  status: string;
  due_ts: string | null;
  closure_predicate: {
    type: "no_defect_code_in_window" | "manual_confirmation";
    params: Record<string, unknown>;
  };
};

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

const apiUrl = required("MANEX_API_URL");
const apiKey = required("MANEX_SERVICE_ROLE_KEY");

const supabase = new PostgrestClient(apiUrl, {
  headers: {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
  },
});

const evaluateNoDefectCodeInWindow = async (
  initiative: InitiativeRow,
): Promise<{ satisfied: boolean; metricValue: number }> => {
  const defectCode = String(initiative.closure_predicate.params.defect_code ?? "");
  if (!defectCode) {
    throw new Error(`Missing defect_code for initiative ${initiative.initiative_id}`);
  }

  const days = Number(initiative.closure_predicate.params.days ?? 14);
  const productId = initiative.closure_predicate.params.product_id
    ? String(initiative.closure_predicate.params.product_id)
    : null;
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  let query = supabase
    .from("defect")
    .select("defect_id", { count: "exact", head: true })
    .eq("defect_code", defectCode)
    .gte("ts", since);
  if (productId) query = query.eq("product_id", productId);

  const { count, error } = await query;
  if (error) {
    throw new Error(`Closure query failed for ${initiative.initiative_id}: ${error.message}`);
  }

  const defects = count ?? 0;
  return { satisfied: defects === 0, metricValue: defects };
};

const evaluateInitiative = async (initiative: InitiativeRow) => {
  if (initiative.closure_predicate.type === "manual_confirmation") {
    return { satisfied: false, metric: "manual_confirmation", value: 0, confidence: 0.6 };
  }

  if (initiative.closure_predicate.type === "no_defect_code_in_window") {
    const result = await evaluateNoDefectCodeInWindow(initiative);
    return {
      satisfied: result.satisfied,
      metric: "defect_count_in_window",
      value: result.metricValue,
      confidence: 0.75,
    };
  }

  return { satisfied: false, metric: "unknown", value: 0, confidence: 0.1 };
};

const applyClosure = async (
  initiative: InitiativeRow,
  evaluation: { satisfied: boolean; metric: string; value: number; confidence: number },
) => {
  const { error } = await supabase.rpc("resolve_apply_closure_result", {
    _initiative_id: initiative.initiative_id,
    _incident_id: initiative.incident_id,
    _satisfied: evaluation.satisfied,
    _metric: evaluation.metric,
    _value: evaluation.value,
    _confidence: evaluation.confidence,
    _measured_ts: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to apply closure for ${initiative.initiative_id}: ${error.message}`);
  }
};

const run = async () => {
  const { data: initiatives, error } = await supabase
    .from("initiative")
    .select("initiative_id,incident_id,status,due_ts,closure_predicate")
    .in("status", ["approved", "in_progress", "reopen"]);
  if (error) {
    throw new Error(`Failed to load initiatives: ${error.message}`);
  }

  for (const initiative of (initiatives ?? []) as InitiativeRow[]) {
    const evaluation = await evaluateInitiative(initiative);
    if (evaluation.satisfied) {
      await applyClosure(initiative, evaluation);
      continue;
    }

    if (initiative.due_ts && new Date(initiative.due_ts).getTime() < Date.now()) {
      await applyClosure(initiative, evaluation);
    }
  }
};

void run();
