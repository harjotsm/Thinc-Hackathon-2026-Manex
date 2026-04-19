import { ZodError } from "zod";
import type { ToolSpec, ToolCtx } from "./types";
import type { ToolCallResult } from "@/server/agent/types";

const registry = new Map<string, ToolSpec>();

export const registerTool = <I>(spec: ToolSpec<I>): void => {
  if (registry.has(spec.name)) {
    throw new Error(`Tool already registered: ${spec.name}`);
  }
  registry.set(spec.name, spec as ToolSpec);
};

export const getTool = (name: string): ToolSpec | undefined => registry.get(name);

export const allTools = (): ToolSpec[] => Array.from(registry.values());

export const nonWriteTools = (): ToolSpec[] =>
  Array.from(registry.values()).filter((t) => !t.is_write);

export const invokeTool = async (
  name: string,
  input: unknown,
  ctx: ToolCtx = {},
): Promise<ToolCallResult> => {
  const tool = registry.get(name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  let parsed: unknown;
  try {
    parsed = tool.input_schema.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(
        `Tool '${name}' input validation failed: ${err.issues.map((i) => i.message).join("; ")}`,
      );
    }
    throw err;
  }
  return tool.handler(parsed, ctx);
};
