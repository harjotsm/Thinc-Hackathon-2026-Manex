import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { ToolCallResult } from "@/server/agent/types";
import type { ToolSpec } from "../types";

// The registry is a module-level singleton (Map). To isolate tests we reset modules
// between each test so the Map starts empty in every test.

type AnyHandler = (_input: unknown, _ctx: unknown) => Promise<ToolCallResult>;

const makeSpec = (
  name: string,
  schema: z.ZodTypeAny = z.object({}),
  handler?: AnyHandler,
  is_write = false,
): ToolSpec => ({
  name,
  description: `Test tool ${name}`,
  input_schema: schema,
  handler:
    handler ??
    (async (_input, _ctx) => ({
      tool_call_id: `TC-${name}`,
      tool: name,
      summary: `ok`,
      data: null,
    })),
  is_write,
});

// Helper: get a fresh registry after module reset
async function getRegistry() {
  const mod = await import("../registry");
  return {
    registerTool: mod.registerTool,
    getTool: mod.getTool,
    allTools: mod.allTools,
    nonWriteTools: mod.nonWriteTools,
    invokeTool: mod.invokeTool,
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe("registerTool", () => {
  it("throws on duplicate name registration", async () => {
    const { registerTool } = await getRegistry();
    const spec = makeSpec("dup_tool");
    registerTool(spec);
    expect(() => registerTool(spec)).toThrowError("Tool already registered: dup_tool");
  });
});

describe("invokeTool", () => {
  it("throws on unknown tool", async () => {
    const { invokeTool } = await getRegistry();
    await expect(invokeTool("no_such_tool", {})).rejects.toThrow("Unknown tool: no_such_tool");
  });

  it("throws with Zod validation error on invalid input", async () => {
    const { registerTool, invokeTool } = await getRegistry();
    const schema = z.object({ count: z.number() });
    registerTool(makeSpec("typed_tool", schema));
    await expect(invokeTool("typed_tool", { count: "not-a-number" })).rejects.toThrow(
      /input validation failed/,
    );
  });

  it("passes parsed input to handler", async () => {
    const { registerTool, invokeTool } = await getRegistry();
    const schema = z.object({ value: z.number() });
    let received: unknown;
    const spec = makeSpec("echo_tool", schema, async (input, _ctx) => {
      received = input;
      return { tool_call_id: "TC-1", tool: "echo_tool", summary: "done", data: input };
    });
    registerTool(spec);
    await invokeTool("echo_tool", { value: 42 });
    expect(received).toEqual({ value: 42 });
  });

  it("returns the handler result", async () => {
    const { registerTool, invokeTool } = await getRegistry();
    const expected: ToolCallResult = {
      tool_call_id: "TC-99",
      tool: "ret_tool",
      summary: "test summary",
      data: [1, 2, 3],
    };
    registerTool(makeSpec("ret_tool", z.object({}), async (_input, _ctx) => expected));
    const result = await invokeTool("ret_tool", {});
    expect(result).toEqual(expected);
  });
});

describe("allTools / nonWriteTools", () => {
  it("allTools returns all registered tools", async () => {
    const { registerTool, allTools } = await getRegistry();
    registerTool(makeSpec("tool_a"));
    registerTool(makeSpec("tool_b"));
    const names = allTools().map((t: ToolSpec) => t.name);
    expect(names).toContain("tool_a");
    expect(names).toContain("tool_b");
    expect(names).toHaveLength(2);
  });

  it("nonWriteTools filters out write-gated tools", async () => {
    const { registerTool, nonWriteTools } = await getRegistry();
    registerTool(makeSpec("read_tool", z.object({}), undefined, false));
    registerTool(makeSpec("write_tool", z.object({}), undefined, true));
    const names = nonWriteTools().map((t: ToolSpec) => t.name);
    expect(names).toContain("read_tool");
    expect(names).not.toContain("write_tool");
  });
});
