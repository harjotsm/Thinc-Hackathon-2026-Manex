import { z } from "zod";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  incident_id: z.string().min(1),
  top_k: z.number().int().min(1).max(20).optional(),
});

registerTool({
  name: "find_related_incidents",
  description:
    "Find incidents semantically related to the given incident via centroid_embedding similarity. Stub — embedding backfill pending.",
  input_schema: Input,
  is_stub: true,
  handler: async (_input): Promise<ToolCallResult> => ({
    tool_call_id: makeId("TC"),
    tool: "find_related_incidents",
    summary:
      "stub — semantic incident-to-incident requires centroid_embedding; pending backfill",
    data: [],
  }),
  groups: ["signal-incident"],
});
