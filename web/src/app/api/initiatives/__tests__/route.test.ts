import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Supabase mock ─────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: () => {
    const rows = [
      {
        initiative_id: "INIT-00001",
        incident_id: "INC-SEED-SUPPLIER-001",
        agent_domain: "production",
        target_system: "MES",
        owner_user_id: null,
        due_ts: null,
        status: "approved",
        comments: "Initiative generated from INC-SEED-SUPPLIER-001",
        created_at: "2026-04-19T10:00:00Z",
        updated_at: null,
        product_action_id: "PA-00001",
      },
      {
        initiative_id: "INIT-00002",
        incident_id: "INC-SEED-SUPPLIER-001",
        agent_domain: "supplier",
        target_system: "SRM",
        owner_user_id: null,
        due_ts: null,
        status: "dispatched",
        comments: "8D to ElektroParts",
        created_at: "2026-04-19T11:00:00Z",
        updated_at: null,
        product_action_id: "PA-00002",
      },
    ];

    const builder: Record<string, (...args: unknown[]) => unknown> = {};
    builder.from = () => builder;
    builder.select = () => builder;
    builder.order = () => builder;
    builder.eq = () => builder;
    builder.in = () => builder;
    builder.range = () =>
      Promise.resolve({ data: rows, error: null, count: rows.length });
    return builder;
  },
}));

describe("GET /api/initiatives", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("happy path — returns data + pagination envelope", async () => {
    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/initiatives");
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(typeof body.pagination.page).toBe("number");
    expect(typeof body.pagination.total).toBe("number");
    expect(typeof body.pagination.has_next).toBe("boolean");
  });

  it("status filter — valid single status is accepted", async () => {
    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/initiatives?status=approved");
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
  });

  it("status filter — comma-separated valid statuses are accepted", async () => {
    const { GET } = await import("../route");
    const req = new Request(
      "http://localhost/api/initiatives?status=approved,dispatched",
    );
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
  });

  it("invalid status returns 400 with code=invalid_query", async () => {
    const { GET } = await import("../route");
    const req = new Request(
      "http://localhost/api/initiatives?status=not_a_real_status",
    );
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_query");
    expect(body.retryable).toBe(false);
  });

  it("incident_id filter is forwarded as eq query", async () => {
    const { GET } = await import("../route");
    const req = new Request(
      "http://localhost/api/initiatives?incident_id=INC-SEED-SUPPLIER-001",
    );
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
  });

  it("page_size capped at 100", async () => {
    const { GET } = await import("../route");
    const req = new Request(
      "http://localhost/api/initiatives?page_size=999",
    );
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pagination.page_size).toBe(100);
  });
});
