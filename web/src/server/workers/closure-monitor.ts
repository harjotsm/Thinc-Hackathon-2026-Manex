import { PostgrestClient } from "@supabase/postgrest-js";
import { env } from "@/lib/env";

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

type ClosureEvaluation = {
  satisfied: boolean;
  metric: string;
  value: number;
  confidence: number;
};

const getPostgrestClient = () => {
  const apiUrl = env.serverSupabaseUrl;
  const apiKey = env.serverSupabaseServiceKey ?? env.publicSupabaseAnonKey;
  if (!apiUrl || !apiKey) {
    throw new Error("Missing MANEX_API_URL/MANEX_SERVICE_ROLE_KEY for closure monitor.");
  }

  return new PostgrestClient(apiUrl, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  });
};

const evaluateNoDefectCodeInWindow = async (
  client: PostgrestClient,
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

  let query = client
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

const evaluateInitiative = async (
  client: PostgrestClient,
  initiative: InitiativeRow,
): Promise<ClosureEvaluation> => {
  if (initiative.closure_predicate.type === "manual_confirmation") {
    return { satisfied: false, metric: "manual_confirmation", value: 0, confidence: 0.6 };
  }

  if (initiative.closure_predicate.type === "no_defect_code_in_window") {
    const result = await evaluateNoDefectCodeInWindow(client, initiative);
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
  client: PostgrestClient,
  initiative: InitiativeRow,
  evaluation: ClosureEvaluation,
) => {
  const { error } = await client.rpc("resolve_apply_closure_result", {
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

export const runClosureMonitor = async () => {
  const client = getPostgrestClient();
  const { data: initiatives, error } = await client
    .from("initiative")
    .select("initiative_id,incident_id,status,due_ts,closure_predicate")
    .in("status", ["approved", "in_progress", "reopen"]);
  if (error) {
    throw new Error(`Failed to load initiatives: ${error.message}`);
  }

  let evaluated = 0;
  let closed = 0;
  let reopened = 0;

  for (const initiative of (initiatives ?? []) as InitiativeRow[]) {
    evaluated += 1;
    const evaluation = await evaluateInitiative(client, initiative);
    if (evaluation.satisfied) {
      await applyClosure(client, initiative, evaluation);
      closed += 1;
      continue;
    }

    if (initiative.due_ts && new Date(initiative.due_ts).getTime() < Date.now()) {
      await applyClosure(client, initiative, evaluation);
      reopened += 1;
    }
  }

  return {
    evaluated,
    closed,
    reopened,
  };
};
