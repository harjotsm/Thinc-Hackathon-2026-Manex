import { z } from "zod";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  initiative_id: z.string().min(1),
  metric: z.string().min(1),
  value: z.number(),
  confidence: z.number().min(0).max(1),
  method: z.string().min(1),
});

registerTool({
  name: "emit_impact_measurement",
  description:
    "Record an impact measurement for a completed initiative. Stub — not wired to impact_measurement table in M3.",
  input_schema: Input,
  is_write: true,
  is_stub: true,
  handler: async (_input): Promise<ToolCallResult> => ({
    tool_call_id: makeId("TC"),
    tool: "emit_impact_measurement",
    summary: "stub — emit_impact_measurement not wired to impact_measurement table in M3",
    data: {
      ok: true,
      measurement_id: `IMP-STUB-${makeId("").slice(0, 12)}`,
      stub: true,
    },
  }),
  groups: ["write-gated"],
});
