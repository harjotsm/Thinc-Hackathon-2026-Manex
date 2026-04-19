import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";

// ─── Module mocks (must come before imports of the module under test) ──────────

// server-only: aliased to a no-op stub in vitest.config.ts
vi.mock("server-only", () => ({}));

// next/server: vi.mock factory is hoisted, so we cannot reference outer variables
// here. We declare a module-level vi.fn() and then override its implementation
// per test via mockImplementation. The factory just needs to return the shape.
vi.mock("next/server", () => ({
  after: vi.fn((cb: () => Promise<void>) => cb()),
}));

// Supabase client
vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

// Orchestrator — mock the heavy LLM pipeline; we only care that dispatch calls it
vi.mock("@/server/agent/orchestrator", () => ({
  runOrchestratorWithSession: vi.fn().mockResolvedValue({}),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import * as nextServer from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { runOrchestratorWithSession } from "@/server/agent/orchestrator";
import { maybeDispatchOrchestrator } from "../dispatch";

// after() accepts AfterTask<T> = Promise<T> | (() => T | Promise<T>).
// We cast broadly to vi.fn so we can control the implementation per test.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAfter = nextServer.after as unknown as ReturnType<typeof vi.fn>;
const mockGetClient = getSupabaseServerClient as MockedFunction<
  typeof getSupabaseServerClient
>;
const mockRunOrchestrator = runOrchestratorWithSession as MockedFunction<
  typeof runOrchestratorWithSession
>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal Supabase-like chainable mock.
 *
 * Supports the query chain used by maybeDispatchOrchestrator:
 *   .from(table).select(...).eq(...).eq(...).maybeSingle()
 *   .from(table).select(...).eq(...).in(...).gte(...).order(...).limit(...).maybeSingle()
 *   .from(table).insert(...)
 */
const buildMockClient = ({
  runningSession,
  runningError,
  recentSession,
  recentError,
  insertError,
}: {
  runningSession?: { id: string } | null;
  runningError?: { message: string; code?: string } | null;
  recentSession?: { id: string; started_at: string } | null;
  recentError?: { message: string } | null;
  insertError?: { message: string; code?: string } | null;
}) => {
  // Track call count to differentiate the two maybeSingle() calls
  let maybeSingleCallCount = 0;

  const maybeSingle = vi.fn(() => {
    maybeSingleCallCount += 1;
    if (maybeSingleCallCount === 1) {
      // First call: running-session check
      return Promise.resolve({
        data: runningSession ?? null,
        error: runningError ?? null,
      });
    }
    // Second call: recent-session check
    return Promise.resolve({
      data: recentSession ?? null,
      error: recentError ?? null,
    });
  });

  const chainable = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle,
    insert: vi.fn().mockResolvedValue({
      data: null,
      error: insertError ?? null,
    }),
  };

  // Each method returns `chainable` for fluent chaining
  chainable.eq.mockReturnValue(chainable);
  chainable.in.mockReturnValue(chainable);
  chainable.gte.mockReturnValue(chainable);
  chainable.order.mockReturnValue(chainable);
  chainable.limit.mockReturnValue(chainable);
  chainable.select.mockReturnValue(chainable);

  const from = vi.fn(() => chainable);

  return {
    client: { from } as unknown as ReturnType<typeof getSupabaseServerClient>,
    chainable,
    from,
  };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("maybeDispatchOrchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: after() runs the callback immediately so orchestrator calls are
    // observable within the same test. Individual tests override as needed.
    mockAfter.mockImplementation((cb) => cb());
  });

  it("skips dispatch when a running session already exists", async () => {
    const { client } = buildMockClient({
      runningSession: { id: "SES-RUNNING" },
    });
    mockGetClient.mockReturnValue(client);

    const result = await maybeDispatchOrchestrator({
      incidentId: "INC-001",
      triggeredBy: "correlator",
    });

    expect(result.dispatched).toBe(false);
    expect((result as { dispatched: false; reason: string }).reason).toBe(
      "session_already_running",
    );
    expect(mockRunOrchestrator).not.toHaveBeenCalled();
    expect(mockAfter).not.toHaveBeenCalled();
  });

  it("skips dispatch when a recent session exists within the freshness window", async () => {
    const recentTs = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
    const { client } = buildMockClient({
      runningSession: null,
      recentSession: { id: "SES-RECENT", started_at: recentTs },
    });
    mockGetClient.mockReturnValue(client);

    const result = await maybeDispatchOrchestrator({
      incidentId: "INC-002",
      triggeredBy: "correlator",
      maxFreshnessMinutes: 30,
    });

    expect(result.dispatched).toBe(false);
    expect((result as { dispatched: false; reason: string }).reason).toBe(
      "recent_session",
    );
    expect(mockRunOrchestrator).not.toHaveBeenCalled();
  });

  it("dispatches when no running or recent session exists", async () => {
    const { client } = buildMockClient({
      runningSession: null,
      recentSession: null,
      insertError: null,
    });
    mockGetClient.mockReturnValue(client);

    const result = await maybeDispatchOrchestrator({
      incidentId: "INC-003",
      triggeredBy: "correlator",
    });

    expect(result.dispatched).toBe(true);
    expect((result as { dispatched: true; session_id: string }).session_id).toMatch(
      /^SES-/,
    );
    // after() was registered
    expect(mockAfter).toHaveBeenCalledOnce();
    // and the orchestrator was called (because our mockAfter runs cb() immediately)
    expect(mockRunOrchestrator).toHaveBeenCalledOnce();
    expect(mockRunOrchestrator).toHaveBeenCalledWith(
      expect.objectContaining({ incident_id: "INC-003" }),
    );
  });

  it("returns dispatched=false (does not throw) when session insert fails", async () => {
    const { client } = buildMockClient({
      runningSession: null,
      recentSession: null,
      insertError: { message: "connection timeout" },
    });
    mockGetClient.mockReturnValue(client);

    const result = await maybeDispatchOrchestrator({
      incidentId: "INC-004",
      triggeredBy: "correlator",
    });

    expect(result.dispatched).toBe(false);
    expect(
      (result as { dispatched: false; reason: string }).reason,
    ).toContain("session_insert_error");
    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockRunOrchestrator).not.toHaveBeenCalled();
  });

  it("returns dispatched=false when the running-session query errors", async () => {
    const { client } = buildMockClient({
      runningError: { message: "network error" },
    });
    mockGetClient.mockReturnValue(client);

    const result = await maybeDispatchOrchestrator({
      incidentId: "INC-005",
      triggeredBy: "manual",
    });

    expect(result.dispatched).toBe(false);
    expect(
      (result as { dispatched: false; reason: string }).reason,
    ).toContain("session_query_error");
    expect(mockAfter).not.toHaveBeenCalled();
  });
});
