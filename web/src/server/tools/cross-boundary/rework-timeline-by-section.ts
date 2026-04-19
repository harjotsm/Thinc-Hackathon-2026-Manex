import { z } from "zod";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  section_id: z.string().optional(),
  window_weeks: z.number().int().min(1).max(52).optional(),
});

// Canned 2-week sample
const CANNED_DATA = [
  {
    week_start: "2026-01-06",
    section_id: "SEC-MONTAGE-L1",
    rework_count: 7,
    total_time_minutes: 210,
    top_action: "Lötstelle nacharbeiten",
  },
  {
    week_start: "2026-01-13",
    section_id: "SEC-MONTAGE-L1",
    rework_count: 11,
    total_time_minutes: 330,
    top_action: "Lötstelle nacharbeiten",
  },
];

registerTool({
  name: "rework_timeline_by_section",
  description:
    "Rework counts and time aggregated by section and week. Stub — Story 2 only, returns canned sample.",
  input_schema: Input,
  is_stub: true,
  handler: async (_input): Promise<ToolCallResult> => ({
    tool_call_id: makeId("TC"),
    tool: "rework_timeline_by_section",
    summary: "stub — rework timeline returns canned 2-week sample; Story 2 only",
    data: CANNED_DATA,
  }),
  groups: ["cross-boundary"],
});
