import { z } from "zod";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  image_url: z.string().url(),
  expected_categories: z.array(z.string()).optional(),
});

registerTool({
  name: "classify_defect_image",
  description:
    "Classify a defect image into defect categories using vision model. Stub — vision disabled for 24h demo.",
  input_schema: Input,
  is_stub: true,
  handler: async (_input): Promise<ToolCallResult> => ({
    tool_call_id: makeId("TC"),
    tool: "classify_defect_image",
    summary: "stub — vision classification disabled for 24h demo",
    data: {
      label: "scratch",
      confidence: 0.82,
      categories_matched: [],
      source: "stub",
    },
  }),
  groups: ["semantic", "vision"],
});
