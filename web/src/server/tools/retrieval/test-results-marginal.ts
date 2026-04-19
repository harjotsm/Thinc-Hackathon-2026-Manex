import { z } from "zod";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  product_id: z.string().optional(),
  test_key: z.string().optional(),
  window_days: z.number().int().min(1).max(365).optional(),
});

// Story-2 stub — returns canned marginal test result sample
const CANNED_DATA = [
  {
    test_result_id: "TR-STUB-001",
    product_id: "PRD-00042",
    test_key: "VIB_TEST",
    overall_result: "MARGINAL",
    test_value: "0.98",
    unit: "g",
    section_id: "SEC-MONTAGE-L1",
    ts: "2026-01-14T08:31:00Z",
    notes: "vibration amplitude near upper limit",
  },
  {
    test_result_id: "TR-STUB-002",
    product_id: "PRD-00044",
    test_key: "VIB_TEST",
    overall_result: "MARGINAL",
    test_value: "0.97",
    unit: "g",
    section_id: "SEC-MONTAGE-L1",
    ts: "2026-01-21T09:15:00Z",
    notes: "repeated marginal — station drift suspected",
  },
];

registerTool({
  name: "test_results_marginal",
  description:
    "Fetch marginal test results from test_result table. Stub — Story-2 only, not wired to Investigate loop in M3.",
  input_schema: Input,
  is_stub: true,
  handler: async (_input): Promise<ToolCallResult> => ({
    tool_call_id: makeId("TC"),
    tool: "test_results_marginal",
    summary: "stub — test_results_marginal returns canned sample; Story 2 only",
    data: CANNED_DATA,
  }),
  groups: ["retrieval"],
});
