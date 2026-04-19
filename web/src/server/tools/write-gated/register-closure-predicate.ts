import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import { legacyClosurePredicateSchema } from "@/server/schemas/closure";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  initiative_id: z.string().min(1),
  closure_predicate: legacyClosurePredicateSchema,
});
type Input = z.infer<typeof Input>;

export const registerClosurePredicate = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("initiative")
    .select("initiative_id,closure_predicate")
    .eq("initiative_id", args.initiative_id)
    .single();

  if (fetchErr) throw new Error(`register_closure_predicate fetch failed: ${fetchErr.message}`);

  const storedJson = JSON.stringify(existing.closure_predicate);
  const newJson = JSON.stringify(args.closure_predicate);

  if (storedJson === newJson) {
    return {
      tool_call_id: makeId("TC"),
      tool: "register_closure_predicate",
      summary: `Closure predicate for ${args.initiative_id} already persisted (no-op).`,
      data: { ok: true, already_persisted: true },
    };
  }

  const { error: updateErr } = await supabase
    .from("initiative")
    .update({ closure_predicate: args.closure_predicate })
    .eq("initiative_id", args.initiative_id);

  if (updateErr)
    throw new Error(`register_closure_predicate update failed: ${updateErr.message}`);

  return {
    tool_call_id: makeId("TC"),
    tool: "register_closure_predicate",
    summary: `Closure predicate for ${args.initiative_id} updated.`,
    data: { ok: true, already_persisted: false, updated: true },
  };
};

registerTool({
  name: "register_closure_predicate",
  description:
    "Verify or update the closure predicate for an existing initiative. WRITE — only available in Propose phase.",
  input_schema: Input,
  is_write: true,
  handler: async (input) => registerClosurePredicate(input),
  groups: ["write-gated"],
});
