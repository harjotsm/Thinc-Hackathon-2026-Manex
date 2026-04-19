import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { InitiativeRow } from "@/server/schemas/initiative";

// ─── Options ──────────────────────────────────────────────────────────────────

export type GetInitiativesOpts = {
  incidentId?: string;
  status?: string[];
  pageSize?: number;
};

const SELECT_COLS =
  "initiative_id,incident_id,agent_domain,target_system,owner_user_id,due_ts,status,created_ts,closed_ts,product_action_id,external_ref";

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function getInitiatives(
  opts: GetInitiativesOpts = {},
): Promise<InitiativeRow[]> {
  const supabase = getSupabaseServerClient();
  const pageSize = Math.min(opts.pageSize ?? 200, 200);

  let query = supabase
    .from("initiative")
    .select(SELECT_COLS)
    .order("created_ts", { ascending: false })
    .range(0, pageSize - 1);

  if (opts.incidentId) {
    query = query.eq("incident_id", opts.incidentId);
  }
  if (opts.status && opts.status.length > 0) {
    query = query.in("status", opts.status);
  }

  const { data, error } = await query;

  if (error) {
    console.warn(`[initiatives-loader] DB error: ${error.message}`);
    return [];
  }

  return (data ?? []) as unknown as InitiativeRow[];
}
