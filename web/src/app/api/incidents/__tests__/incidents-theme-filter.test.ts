import { describe, it, expect, vi } from "vitest";

const captured = { in: [] as Array<[string, string[]]>, eq: [] as Array<[string, string]> };

type Builder = Record<string, (...args: unknown[]) => unknown>;

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: () => {
    const builder: Builder = {};
    builder.from = () => builder;
    builder.select = () => builder;
    builder.order = () => builder;
    builder.in = (...args: unknown[]) => { captured.in.push([args[0] as string, args[1] as string[]]); return builder; };
    builder.eq = (...args: unknown[]) => { captured.eq.push([args[0] as string, args[1] as string]); return builder; };
    builder.gte = () => builder;
    builder.or = () => builder;
    builder.range = () => Promise.resolve({ data: [], error: null, count: 0 });
    return builder;
  },
}));

describe("GET /api/incidents?theme=<signature>", () => {
  it("splits supplier:PM-00008 into archetype + product filters", async () => {
    captured.in.length = 0;
    captured.eq.length = 0;
    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/incidents?theme=supplier:PM-00008");
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    expect(captured.in.find(([c]) => c === "archetype")?.[1]).toEqual(["supplier"]);
    expect(captured.eq.find(([c]) => c === "primary_product_id")?.[1]).toBe("PM-00008");
  });

  it("ignores theme=unknown:— (catch-all signature)", async () => {
    captured.in.length = 0;
    captured.eq.length = 0;
    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/incidents?theme=unknown:—");
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    expect(captured.in.find(([c]) => c === "archetype")?.[1]).toEqual(["unknown"]);
    expect(captured.eq.find(([c]) => c === "primary_product_id")).toBeUndefined();
  });
});
