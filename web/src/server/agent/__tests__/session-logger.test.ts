import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";

// Mock server-only module (not available in test env)
vi.mock("server-only", () => ({}));

// Mock supabase-server
vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { logTurn, logEvent, logPhaseStart } from "../session-logger";

const mockGetClient = getSupabaseServerClient as MockedFunction<
  typeof getSupabaseServerClient
>;

// ─── Helper to build a chainable mock client ─────────────────────────────────

type InsertMock = ReturnType<typeof vi.fn>;

const buildInsertChain = (insertReturnValue: {
  data?: unknown;
  error: { message: string } | null;
}) => {
  const single = vi.fn().mockResolvedValue(insertReturnValue);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({
    select,
    // For calls that don't chain .select().single() — just resolve
    then: (resolve: (v: typeof insertReturnValue) => void) =>
      Promise.resolve(insertReturnValue).then(resolve),
    // Support awaiting the insert directly
    ...insertReturnValue,
  }));
  return { insert, select, single };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("logTurn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an ST-prefixed id on success", async () => {
    // Mock: insert resolves with no error (no .select chain needed)
    const from = vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
    mockGetClient.mockReturnValue({ from } as unknown as ReturnType<typeof getSupabaseServerClient>);

    const id = await logTurn({
      session_id: "SES-001",
      turn_index: 0,
      phase: "classify",
      role: "assistant",
    });

    expect(id).toMatch(/^ST-[A-Z0-9]+$/);
    expect(from).toHaveBeenCalledWith("session_turn");
  });

  it("throws when insert returns an error", async () => {
    const from = vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: { message: "insert failed" } }),
    }));
    mockGetClient.mockReturnValue({ from } as unknown as ReturnType<typeof getSupabaseServerClient>);

    await expect(
      logTurn({
        session_id: "SES-001",
        turn_index: 0,
        phase: "classify",
        role: "tool",
      }),
    ).rejects.toThrow("logTurn failed: insert failed");
  });
});

describe("logEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the event_seq assigned by the DB", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { event_seq: 42 },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));

    mockGetClient.mockReturnValue({ from } as unknown as ReturnType<typeof getSupabaseServerClient>);

    const seq = await logEvent("SES-001", "phase_start", { phase: "classify" });

    expect(seq).toBe(42);
    expect(from).toHaveBeenCalledWith("session_event");
    expect(insert).toHaveBeenCalledWith({
      session_id: "SES-001",
      event_type: "phase_start",
      payload: { phase: "classify" },
    });
  });

  it("throws when insert returns an error", async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "constraint violation" },
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));

    mockGetClient.mockReturnValue({ from } as unknown as ReturnType<typeof getSupabaseServerClient>);

    await expect(
      logEvent("SES-BAD", "phase_start", {}),
    ).rejects.toThrow("logEvent failed: constraint violation");
  });
});

describe("logPhaseStart", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls logEvent with event_type='phase_start' and payload containing the phase", async () => {
    const capturedInserts: unknown[] = [];
    const single = vi.fn().mockResolvedValue({
      data: { event_seq: 1 },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn((payload: unknown) => {
      capturedInserts.push(payload);
      return { select };
    });
    const from = vi.fn(() => ({ insert }));

    mockGetClient.mockReturnValue({ from } as unknown as ReturnType<typeof getSupabaseServerClient>);

    await logPhaseStart("SES-002", "investigate", { tool_count: 3 });

    expect(from).toHaveBeenCalledWith("session_event");
    expect(capturedInserts[0]).toMatchObject({
      session_id: "SES-002",
      event_type: "phase_start",
      payload: { phase: "investigate", tool_count: 3 },
    });
  });
});
