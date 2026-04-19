import { describe, it, expect, vi, beforeEach } from "vitest";

const mockData = [
  {
    incident_id: "INC-1",
    title: "Cold solder cluster",
    archetype: "supplier",
    severity: "high",
    last_activity_at: "2026-04-19T12:00:00Z",
    signal_count: 8,
    primary_product_id: "PM-00008",
    // DB column is "primary_part" (route maps it to primary_part_number internally)
    primary_part: null,
    centroid_embedding: null,
  },
  {
    incident_id: "INC-2",
    title: "Thermal R33",
    archetype: "design",
    severity: "high",
    last_activity_at: "2026-04-19T11:00:00Z",
    signal_count: 12,
    primary_product_id: "PM-00012",
    // DB column is "primary_part" (route maps it to primary_part_number internally)
    primary_part: "R33",
    centroid_embedding: null,
  },
];

// Build a supabase mock chain where every step is awaitable (returns { data, error })
// AND supports further chaining. This is needed because the route conditionally
// chains .in() / .eq() before awaiting — we can't predict which methods are called.
function makeAwaitableChain(resolvedValue: { data: unknown; error: null | { message: string } }) {
  // Every method on the chain returns the same chainable promise-like object.
  const chain: Record<string, unknown> = {};

  const thenable = {
    ...chain,
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(resolvedValue).then(onFulfilled, onRejected);
    },
    catch(onRejected: (e: unknown) => unknown) {
      return Promise.resolve(resolvedValue).catch(onRejected);
    },
  };

  // Add all Supabase PostgREST builder methods so any chain works
  const methods = ["select", "order", "gte", "lte", "gt", "lt", "eq", "neq", "in", "limit", "range", "or", "ilike", "single"];
  for (const m of methods) {
    Object.assign(thenable, { [m]: () => thenable });
  }

  return thenable;
}

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: () => ({
    from: () => makeAwaitableChain({ data: mockData, error: null }),
  }),
}));

vi.mock("@/lib/anthropic", () => ({ getAnthropicClient: () => null }));

describe("GET /api/themes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns themes with the supplier and design signatures", async () => {
    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/themes?lens=engineer&window=7d");
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.themes.map((t: { signature: string }) => t.signature).sort()).toEqual([
      "design:R33",
      "supplier:PM-00008",
    ]);
    expect(body.lens).toBe("engineer");
    expect(body.window_days).toBe(7);
  });

  it("rejects an invalid lens value", async () => {
    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/themes?lens=marketing");
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(400);
  });
});
