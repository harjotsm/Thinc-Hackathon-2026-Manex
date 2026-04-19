import { z } from "zod";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const archetypeEnum = z.enum(["supplier", "drift", "design", "operator", "unknown"]);

const Input = z.object({
  incident_id: z.string().min(1),
  signature_text: z.string().min(1),
  fix_summary: z.string().min(1),
  archetype: archetypeEnum,
  prompt_snippet: z.string().optional(),
  triggers: z.unknown().optional(),
  root_cause: z.string().optional(),
  root_cause_evidence: z.unknown().optional(),
});

registerTool({
  name: "emit_lesson",
  description:
    "Emit a lesson derived from a resolved incident into the lesson table. Stub — lesson writes not wired in M3.",
  input_schema: Input,
  is_write: true,
  is_stub: true,
  handler: async (_input): Promise<ToolCallResult> => ({
    tool_call_id: makeId("TC"),
    tool: "emit_lesson",
    summary: "stub — emit_lesson not wired to lesson table in M3",
    data: {
      ok: true,
      lesson_id: `LSN-STUB-${makeId("").slice(0, 12)}`,
      stub: true,
    },
  }),
  groups: ["write-gated"],
});
