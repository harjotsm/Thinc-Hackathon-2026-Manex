import type { z } from "zod";
import type { ToolCallResult } from "@/server/agent/types";

export type ToolCtx = {
  session_id?: string;
  incident_id?: string;
  user_id?: string;
};

export type ToolHandler<I> = (input: I, ctx: ToolCtx) => Promise<ToolCallResult>;

export type ToolSpec<I = unknown> = {
  name: string;
  description: string;
  input_schema: z.ZodType<I>;
  handler: ToolHandler<I>;
  is_write?: boolean;
  is_stub?: boolean;
  groups?: string[];
};

// Re-export ToolCallResult for convenience so callers import one place
export type { ToolCallResult };
