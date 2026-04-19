import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import { agentDomainEnum } from "@/server/schemas/initiative";
import { legacyClosurePredicateSchema } from "@/server/schemas/closure";
import type { ToolCallResult } from "@/server/agent/types";

// Input reuses the canonical initiative schema shape
const Input = z.object({
  incident_id: z.string(),
  agent_domain: agentDomainEnum,
  target_system: z.string(),
  external_ref: z.string().optional(),
  owner_user_id: z.string().optional(),
  due_ts: z.string().datetime().optional(),
  closure_predicate: legacyClosurePredicateSchema,
  product_id: z.string().optional(),
  defect_id: z.string().optional(),
  section_id: z.string().optional(),
  comments: z.string().optional(),
});
type Input = z.infer<typeof Input>;

export const createInitiative = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();

  const initiativeId = makeId("INI");
  const actionId = makeId("PA");

  // RPC signature (from 00004_resolve_workflow_atomic.sql):
  // resolve_approve_initiative(
  //   _initiative_id, _incident_id, _agent_domain, _target_system,
  //   _owner_user_id, _due_ts, _status, _closure_predicate,
  //   _product_id, _defect_id, _section_id, _comments, _action_id
  // )
  const { data, error } = await supabase.rpc("resolve_approve_initiative", {
    _initiative_id: initiativeId,
    _incident_id: args.incident_id,
    _agent_domain: args.agent_domain,
    _target_system: args.target_system,
    _owner_user_id: args.owner_user_id ?? null,
    _due_ts: args.due_ts ?? null,
    _status: "approved",
    _closure_predicate: args.closure_predicate,
    _product_id: args.product_id ?? null,
    _defect_id: args.defect_id ?? null,
    _section_id: args.section_id ?? null,
    _comments: args.comments ?? null,
    _action_id: actionId,
  });

  if (error) throw new Error(`create_initiative RPC failed: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;

  return {
    tool_call_id: makeId("TC"),
    tool: "create_initiative",
    summary: `Initiative ${initiativeId} created and approved for ${args.agent_domain} → ${args.target_system}.`,
    data: {
      initiative_id: initiativeId,
      status: "approved",
      target_system: args.target_system,
      external_ref: args.external_ref ?? actionId,
      product_action_id: row?.product_action_id ?? actionId,
    },
  };
};

registerTool({
  name: "create_initiative",
  description:
    "Create and immediately approve an initiative via resolve_approve_initiative RPC. WRITE — only available in Propose phase.",
  input_schema: Input,
  is_write: true,
  handler: async (input) => createInitiative(input),
  groups: ["write-gated"],
});
