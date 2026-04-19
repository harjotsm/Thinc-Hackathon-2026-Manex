import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { maybeDispatchOrchestrator } from "@/server/agent/dispatch";

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

type SemanticNeighborRow = {
  signal_id: string;
  distance: number;
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

const componentKey = (signals: SignalRecord[]) =>
  signals
    .map((signal) => signal.signal_id)
    .sort()
    .join("|");

const findComponents = (
  nodes: SignalRecord[],
  adjacency: Map<string, Set<string>>,
): SignalRecord[][] => {
  const byId = new Map(nodes.map((node) => [node.signal_id, node]));
  const visited = new Set<string>();
  const components: SignalRecord[][] = [];

  for (const node of nodes) {
    if (visited.has(node.signal_id)) continue;
    const queue = [node.signal_id];
    visited.add(node.signal_id);
    const component: SignalRecord[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const record = byId.get(current);
      if (record) component.push(record);
      const neighbors = adjacency.get(current) ?? new Set<string>();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
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
  if (unlinked.length < 2) {
    return { linkedSignals: 0, incidentIds: [] };
  }

  const byId = new Map(unlinked.map((signal) => [signal.signal_id, signal]));
  const adjacency = new Map<string, Set<string>>();
  for (const signal of unlinked) {
    adjacency.set(signal.signal_id, new Set());
  }

  const groups = new Map<string, string[]>();
  for (const signal of unlinked) {
    const key = deterministicKey(signal);
    const bucket = groups.get(key) ?? [];
    bucket.push(signal.signal_id);
    groups.set(key, bucket);
  }

  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    for (const sourceId of ids) {
      const sourceSet = adjacency.get(sourceId);
      if (!sourceSet) continue;
      for (const targetId of ids) {
        if (sourceId !== targetId) sourceSet.add(targetId);
      }
    }
  }

  for (const signal of unlinked) {
    const { data: semanticNeighbors, error: semanticError } = await supabase.rpc(
      "resolve_semantic_neighbors",
      {
        _signal_id: signal.signal_id,
        _threshold: 0.22,
        _limit_count: 10,
      },
    );

    if (semanticError) {
      continue;
    }

    for (const neighbor of (semanticNeighbors ?? []) as SemanticNeighborRow[]) {
      if (!byId.has(neighbor.signal_id)) continue;
      const sourceSet = adjacency.get(signal.signal_id);
      const targetSet = adjacency.get(neighbor.signal_id);
      if (!sourceSet || !targetSet) continue;
      sourceSet.add(neighbor.signal_id);
      targetSet.add(signal.signal_id);
    }
  }

  const components = findComponents(unlinked, adjacency);
  let linkedSignals = 0;
  const incidentIds: string[] = [];
  const seenComponents = new Set<string>();

  for (const group of components) {
    if (group.length < 2) {
      continue;
    }
    const key = componentKey(group);
    if (seenComponents.has(key)) continue;
    seenComponents.add(key);

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
        correlation: {
          deterministic_group_size: (groups.get(deterministicKey(primary)) ?? []).length,
          semantic_links_considered: group.length,
        },
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

    // Auto-dispatch the LLM orchestrator for each newly created incident.
    // Non-blocking: maybeDispatchOrchestrator registers an after() callback so
    // the correlator (and the enclosing HTTP response) is not delayed.
    // Idempotent: the helper skips if a running or recent session already exists.
    // Wrapped in try/catch so a dispatch failure never breaks the correlator.
    try {
      await maybeDispatchOrchestrator({
        incidentId,
        triggeredBy: "correlator",
      });
    } catch (dispatchErr) {
      // Log but do not propagate — incident creation succeeded; orchestrator
      // can be re-triggered manually or by the next intake call.
      console.error(
        `[correlator] failed to dispatch orchestrator for ${incidentId}:`,
        dispatchErr,
      );
    }
  }

  return { linkedSignals, incidentIds };
};
