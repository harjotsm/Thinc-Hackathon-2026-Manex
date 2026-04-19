/**
 * contributions-api.test.ts
 *
 * Unit tests for M5b API routes:
 * - GET /api/incident/[incidentId]/contributions — returns rows shape
 * - POST /api/incident/[incidentId]/contributions — validates domain + creates row
 *
 * Supabase and invokeTool are mocked; no real DB required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

// Chain-builder for supabase mock
function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: () => chain,
    upsert: () => chain,
    ...overrides,
  };
  return chain;
}

const mockFrom = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: () => ({
    from: (table: string) => {
      mockFrom(table);
      return makeChain();
    },
  }),
}));

vi.mock("@/server/utils/id", () => ({
  makeId: (prefix: string) => `${prefix}-MOCK-001`,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const makeParams = (incidentId: string) => ({
  params: Promise.resolve({ incidentId }),
});

const makeRequest = (method: string, body?: unknown, headers: Record<string, string> = {}) => {
  return new NextRequest("http://localhost/api/test", {
    method,
    headers: new Headers({
      "content-type": "application/json",
      ...headers,
    }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
};

// ── GET tests ──────────────────────────────────────────────────────────────────

describe("GET /api/incident/[incidentId]/contributions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns contributions array on success", async () => {
    const fakeRows = [
      {
        contribution_id: "CTB-001",
        domain: "central_quality",
        content: "Prior lessons matched.",
        structured_payload: null,
        source: "tool",
        status: "available",
        weight: 1.0,
        created_ts: "2026-04-19T10:00:00Z",
      },
    ];

    // Provide a supabase mock that returns fakeRows
    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseServerClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              order: vi.fn().mockResolvedValue({ data: fakeRows, error: null }),
            }),
          }),
        }),
      }),
    }));

    const { GET } = await import("@/app/api/incident/[incidentId]/contributions/route");
    const req = makeRequest("GET");
    const res = await GET(req, makeParams("INC-BF-9A77BC54"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.incident_id).toBe("INC-BF-9A77BC54");
    expect(Array.isArray(body.contributions)).toBe(true);
    expect(body.contributions).toHaveLength(1);
    expect(body.contributions[0].domain).toBe("central_quality");
  });

  it("returns 500 on DB error", async () => {
    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseServerClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              order: vi.fn().mockResolvedValue({ data: null, error: { message: "db gone" } }),
            }),
          }),
        }),
      }),
    }));

    const { GET } = await import("@/app/api/incident/[incidentId]/contributions/route");
    const req = makeRequest("GET");
    const res = await GET(req, makeParams("INC-001"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("db_error");
    expect(body.retryable).toBe(true);
  });
});

// ── POST tests ─────────────────────────────────────────────────────────────────

describe("POST /api/incident/[incidentId]/contributions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("rejects invalid domain", async () => {
    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseServerClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { incident_id: "INC-001" },
                error: null,
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({ data: { contribution_id: "CTB-MOCK-001" }, error: null }),
            }),
          }),
        }),
      }),
    }));
    vi.doMock("@/server/utils/id", () => ({ makeId: () => "CTB-MOCK-001" }));

    const { POST } = await import("@/app/api/incident/[incidentId]/contributions/route");
    const req = makeRequest("POST", {
      domain: "totally_invalid_domain",
      content: "Some content",
    });
    const res = await POST(req, makeParams("INC-001"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("validation_error");
    expect(body.retryable).toBe(false);
  });

  it("rejects missing content", async () => {
    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseServerClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: { incident_id: "INC-001" }, error: null }),
            }),
          }),
        }),
      }),
    }));

    const { POST } = await import("@/app/api/incident/[incidentId]/contributions/route");
    const req = makeRequest("POST", { domain: "central_quality" }); // missing content
    const res = await POST(req, makeParams("INC-001"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("validation_error");
  });

  it("returns 404 if incident not found", async () => {
    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseServerClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
            }),
          }),
        }),
      }),
    }));

    const { POST } = await import("@/app/api/incident/[incidentId]/contributions/route");
    const req = makeRequest("POST", { domain: "central_quality", content: "test" });
    const res = await POST(req, makeParams("INC-NONEXISTENT"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("incident_not_found");
  });

  it("creates contribution with source=user for valid request", async () => {
    const fakeContribution = {
      contribution_id: "CTB-MOCK-001",
      domain: "central_quality",
      content: "Engineer observation: batch SB-00007 is suspect.",
      source: "user",
      status: "available",
    };

    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseServerClient: () => ({
        from: (table: string) => {
          if (table === "incident") {
            return {
              select: () => ({
                eq: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: { incident_id: "INC-BF-9A77BC54" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          // contribution table
          return {
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({ data: fakeContribution, error: null }),
              }),
            }),
          };
        },
      }),
    }));
    vi.doMock("@/server/utils/id", () => ({ makeId: () => "CTB-MOCK-001" }));

    const { POST } = await import("@/app/api/incident/[incidentId]/contributions/route");
    const req = makeRequest(
      "POST",
      { domain: "central_quality", content: "Engineer observation: batch SB-00007 is suspect." },
      { "x-demo-user": "user_042" },
    );
    const res = await POST(req, makeParams("INC-BF-9A77BC54"));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.contribution).toBeDefined();
    expect(body.contribution.source).toBe("user");
  });

  it("rejects invalid JSON body", async () => {
    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseServerClient: () => ({ from: vi.fn() }),
    }));

    const { POST } = await import("@/app/api/incident/[incidentId]/contributions/route");
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: "not { valid json",
    });
    const res = await POST(req, makeParams("INC-001"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("invalid_json");
  });
});
