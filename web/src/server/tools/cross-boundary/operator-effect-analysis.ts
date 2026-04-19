import { z } from "zod";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  user_id: z.string().optional(),
  window_days: z.number().int().min(1).max(365).optional(),
});

registerTool({
  name: "operator_effect_analysis",
  description:
    "Analyse defect clustering by operator (user_id × rework join). Stub — Story 4 only, not wired in M3.",
  input_schema: Input,
  is_stub: true,
  handler: async (_input): Promise<ToolCallResult> => ({
    tool_call_id: makeId("TC"),
    tool: "operator_effect_analysis",
    summary:
      "stub — operator-effect analysis requires rework × user_id aggregation; wired in post-MVP",
    data: {
      note: "operator-effect analysis requires rework × user_id aggregation; wired in post-MVP",
    },
  }),
  groups: ["cross-boundary"],
});
