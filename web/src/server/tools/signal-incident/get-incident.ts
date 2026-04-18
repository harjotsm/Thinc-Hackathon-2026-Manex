import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  incident_id: z.string().min(1),
});
type Input = z.infer<typeof Input>;

export const getIncident = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();

  const { data: incident, error: incErr } = await supabase
    .from("incident")
    .select(
      "incident_id,status,title,summary,severity,archetype,signature_text,opened_ts,closed_ts,primary_product_id,signal_count",
    )
    .eq("incident_id", args.incident_id)
    .single();

  if (incErr) throw new Error(`get_incident failed: ${incErr.message}`);

  const { data: signals, error: sigErr } = await supabase
    .from("signal")
    .select("signal_id,captured_ts,raw_text,product_id,severity,source,defect_code,batch_id")
    .eq("incident_id", args.incident_id)
    .order("captured_ts", { ascending: false })
    .limit(20);

  if (sigErr) throw new Error(`get_incident signals fetch failed: ${sigErr.message}`);

  const sigList = signals ?? [];
  return {
    tool_call_id: makeId("TC"),
    tool: "get_incident",
    summary: `Incident ${args.incident_id} + ${sigList.length} signals.`,
    data: { incident, signals: sigList },
  };
};

registerTool({
  name: "get_incident",
  description:
    "Fetch a single incident row plus its attached signals (up to 20, newest first).",
  input_schema: Input,
  handler: async (input) => getIncident(input),
  groups: ["signal-incident"],
});
