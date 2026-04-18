import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  incident_id: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
});
type Input = z.infer<typeof Input>;

export const listSignalsForIncident = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("signal")
    .select(
      "signal_id,captured_ts,raw_text,signal_type,source,product_id,part_number,batch_id,section_id,defect_code,severity,user_id,market,shift",
    )
    .eq("incident_id", args.incident_id)
    .order("captured_ts", { ascending: false })
    .limit(args.limit ?? 50);

  if (error) throw new Error(`list_signals_for_incident failed: ${error.message}`);

  const rows = data ?? [];
  return {
    tool_call_id: makeId("TC"),
    tool: "list_signals_for_incident",
    summary: `Found ${rows.length} signals for incident ${args.incident_id}.`,
    data: rows,
  };
};

registerTool({
  name: "list_signals_for_incident",
  description:
    "List all signals attached to an incident, ordered by captured_ts descending.",
  input_schema: Input,
  handler: async (input) => listSignalsForIncident(input),
  groups: ["signal-incident"],
});
