/**
 * classify-lessons.test.ts
 *
 * Unit tests for M5b classify phase:
 * - runClassify returns lessons_retrieved alongside the core ClassifyOutput fields
 * - Parallel contribution tools are fired after lessons retrieval
 *
 * All external deps (Anthropic SDK, invokeTool, logTurn, logPhaseStart/Complete,
 * publishSessionEvent) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock server-only guard (module imports "server-only" at the top)
vi.mock("server-only", () => ({}));

// Anthropic client mock
const mockCreate = vi.fn();
vi.mock("@/lib/anthropic", () => ({
  getAnthropicClient: () => ({
    messages: {
      create: mockCreate,
    },
  }),
}));

// invokeTool mock — we capture calls to verify lessons + contribution tools
const mockInvokeTool = vi.fn();
vi.mock("@/server/tools/registry", () => ({
  invokeTool: (...args: unknown[]) => mockInvokeTool(...args),
  registerTool: vi.fn(),
  getTool: vi.fn(),
  allTools: vi.fn(() => []),
  nonWriteTools: vi.fn(() => []),
}));

// Mock _register side-effects (no actual tool registrations needed here)
vi.mock("@/server/tools/_register", () => ({}));

// Session logger mocks
const mockLogTurn = vi.fn().mockResolvedValue("ST-MOCK");
const mockLogPhaseStart = vi.fn().mockResolvedValue(1);
const mockLogPhaseComplete = vi.fn().mockResolvedValue(2);
vi.mock("@/server/agent/session-logger", () => ({
  logTurn: (...args: unknown[]) => mockLogTurn(...args),
  logPhaseStart: (...args: unknown[]) => mockLogPhaseStart(...args),
  logPhaseComplete: (...args: unknown[]) => mockLogPhaseComplete(...args),
  updateSessionStatus: vi.fn().mockResolvedValue(undefined),
}));

// Event bus mock
vi.mock("@/lib/event-bus", () => ({
  publishSessionEvent: vi.fn(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_LESSON = {
  lesson_id: "LSN-SEED-SUPPLIER",
  title: "Supplier batch escape on PM-00008",
  prompt_snippet: "Check ElektroParts SB-00007 batch for 100µF caps defect concentration.",
  signature_text: "Batch concentration of defects on capacitor PM-00008 from supplier batch.",
  archetype: "supplier",
  cosine: 0.82,
};

const FAKE_CLASSIFY_RESPONSE = {
  archetype: "supplier",
  signature_text: "Batch concentration of defects on capacitor PM-00008 from ElektroParts.",
  initial_hypotheses: ["Bad capacitor batch from ElektroParts", "Process contamination"],
  confidence: 0.85,
};

const FAKE_INCIDENT = {
  incident_id: "INC-BF-9A77BC54",
  title: "High defect rate on PM-00008",
  summary: "Concentration of defects on 100µF capacitor PM-00008 from ElektroParts.",
  primary_product_id: "PRD-00042",
  primary_part: "PM-00008",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runClassify — lessons network effect", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Anthropic Haiku returns valid classify JSON
    mockCreate.mockResolvedValue({
      model: "claude-haiku-4-5-20251001",
      content: [{ type: "text", text: JSON.stringify(FAKE_CLASSIFY_RESPONSE) }],
      usage: { input_tokens: 120, output_tokens: 80 },
    });

    // invokeTool: retrieve_lessons returns fake lesson; contrib tools succeed
    mockInvokeTool.mockImplementation(async (name: string) => {
      if (name === "retrieve_lessons") {
        return {
          tool_call_id: "TC-LESSONS",
          tool: "retrieve_lessons",
          summary: "App-side cosine; returned top 1.",
          data: [FAKE_LESSON],
        };
      }
      // contribution tools
      return {
        tool_call_id: `TC-${name}`,
        tool: name,
        summary: `${name} ok`,
        data: { ok: true, contribution_id: `CTB-${name}`, lessons_matched: 1 },
      };
    });
  });

  it("returns parsed classify fields alongside lessons_retrieved", async () => {
    const { runClassify } = await import("../classify");
    const result = await runClassify("SES-UNIT-TEST", FAKE_INCIDENT);

    expect(result.archetype).toBe("supplier");
    expect(result.signature_text).toBe(FAKE_CLASSIFY_RESPONSE.signature_text);
    expect(result.initial_hypotheses).toHaveLength(2);
    expect(result.confidence).toBe(0.85);
    expect(result.lessons_retrieved).toHaveLength(1);
    expect(result.lessons_retrieved![0].lesson_id).toBe("LSN-SEED-SUPPLIER");
    expect(result.lessons_retrieved![0].cosine).toBeCloseTo(0.82);
  });

  it("calls retrieve_lessons with correct params", async () => {
    const { runClassify } = await import("../classify");
    await runClassify("SES-UNIT-TEST", FAKE_INCIDENT);

    const lessonsCall = mockInvokeTool.mock.calls.find(
      (c: unknown[]) => c[0] === "retrieve_lessons",
    );
    expect(lessonsCall).toBeDefined();
    expect(lessonsCall![1]).toMatchObject({
      query_text: FAKE_CLASSIFY_RESPONSE.signature_text,
      top_k: 3,
      min_cosine: 0.55,
    });
    expect(lessonsCall![2]).toMatchObject({
      session_id: "SES-UNIT-TEST",
      incident_id: "INC-BF-9A77BC54",
    });
  });

  it("fires all 3 contribution tools", async () => {
    const { runClassify } = await import("../classify");
    await runClassify("SES-UNIT-TEST", FAKE_INCIDENT);

    const toolNames = mockInvokeTool.mock.calls.map((c: unknown[]) => c[0]);
    expect(toolNames).toContain("contrib_central_quality");
    expect(toolNames).toContain("contrib_plant_quality");
    expect(toolNames).toContain("contrib_supplier_quality");
  });

  it("contribution tools receive correct incident_id", async () => {
    const { runClassify } = await import("../classify");
    await runClassify("SES-UNIT-TEST", FAKE_INCIDENT);

    for (const name of [
      "contrib_central_quality",
      "contrib_plant_quality",
      "contrib_supplier_quality",
    ]) {
      const call = mockInvokeTool.mock.calls.find((c: unknown[]) => c[0] === name);
      expect(call).toBeDefined();
      expect(call![1]).toMatchObject({ incident_id: "INC-BF-9A77BC54" });
    }
  });

  it("returns empty lessons_retrieved if retrieve_lessons fails", async () => {
    mockInvokeTool.mockImplementation(async (name: string) => {
      if (name === "retrieve_lessons") {
        throw new Error("embedding service unavailable");
      }
      return {
        tool_call_id: `TC-${name}`,
        tool: name,
        summary: "ok",
        data: { ok: true },
      };
    });

    const { runClassify } = await import("../classify");
    const result = await runClassify("SES-UNIT-TEST", FAKE_INCIDENT);

    // Should still succeed, just with empty lessons
    expect(result.archetype).toBe("supplier");
    expect(result.lessons_retrieved).toHaveLength(0);
  });

  it("still succeeds when a contribution tool fails (Promise.allSettled)", async () => {
    mockInvokeTool.mockImplementation(async (name: string) => {
      if (name === "retrieve_lessons") {
        return {
          tool_call_id: "TC-LESSONS",
          tool: "retrieve_lessons",
          summary: "top 1",
          data: [FAKE_LESSON],
        };
      }
      if (name === "contrib_supplier_quality") {
        throw new Error("supplier DB timeout");
      }
      return {
        tool_call_id: `TC-${name}`,
        tool: name,
        summary: "ok",
        data: { ok: true },
      };
    });

    const { runClassify } = await import("../classify");
    // Should not throw
    const result = await runClassify("SES-UNIT-TEST", FAKE_INCIDENT);
    expect(result.archetype).toBe("supplier");
  });
});

describe("runClassify — signal_samples included in user content", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default Anthropic response used by all signal_samples tests
    mockCreate.mockResolvedValue({
      model: "claude-haiku-4-5-20251001",
      content: [{ type: "text", text: JSON.stringify(FAKE_CLASSIFY_RESPONSE) }],
      usage: { input_tokens: 150, output_tokens: 80 },
    });

    // Default invokeTool: lessons returns empty, contrib tools succeed
    mockInvokeTool.mockImplementation(async (name: string) => ({
      tool_call_id: `TC-${name}`,
      tool: name,
      summary: "ok",
      data: name === "retrieve_lessons" ? [] : { ok: true },
    }));
  });

  it("includes 'Recent signals (sampled):' section when signal_samples are provided", async () => {
    const { runClassify } = await import("../classify");
    const incidentWithSignals = {
      ...FAKE_INCIDENT,
      signal_samples: [
        "batch SB-00007 cold solder on 100µF cap",
        "ESR off-spec on CAP-100uF at incoming inspection",
      ],
    };

    await runClassify("SES-SIGNAL-TEST", incidentWithSignals);

    expect(mockCreate).toHaveBeenCalled();
    const callArgs = mockCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMessage = callArgs.messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain("Recent signals (sampled):");
    expect(userMessage?.content).toContain("batch SB-00007 cold solder on 100µF cap");
    expect(userMessage?.content).toContain("ESR off-spec on CAP-100uF at incoming inspection");
  });

  it("omits 'Recent signals (sampled):' section when signal_samples is empty", async () => {
    const { runClassify } = await import("../classify");
    const incidentNoSignals = { ...FAKE_INCIDENT, signal_samples: [] };

    await runClassify("SES-NO-SIGNAL-TEST", incidentNoSignals);

    expect(mockCreate).toHaveBeenCalled();
    const callArgs = mockCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMessage = callArgs.messages.find((m) => m.role === "user");
    expect(userMessage?.content).not.toContain("Recent signals (sampled):");
  });

  it("omits 'Recent signals (sampled):' section when signal_samples is absent", async () => {
    const { runClassify } = await import("../classify");
    // FAKE_INCIDENT has no signal_samples field at all
    await runClassify("SES-ABSENT-SIGNAL-TEST", FAKE_INCIDENT);

    expect(mockCreate).toHaveBeenCalled();
    const callArgs = mockCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMessage = callArgs.messages.find((m) => m.role === "user");
    expect(userMessage?.content).not.toContain("Recent signals (sampled):");
  });

  it("truncates signal samples at 280 characters", async () => {
    const { runClassify } = await import("../classify");
    const longText = "x".repeat(400);
    const incidentLongSignal = {
      ...FAKE_INCIDENT,
      signal_samples: [longText],
    };

    await runClassify("SES-TRUNCATE-TEST", incidentLongSignal);

    expect(mockCreate).toHaveBeenCalled();
    const callArgs = mockCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMessage = callArgs.messages.find((m) => m.role === "user");
    // The content should contain the truncated signal (280 x's), not the full 400
    expect(userMessage?.content).toContain("x".repeat(280));
    expect(userMessage?.content).not.toContain("x".repeat(281));
  });
});

describe("parseClassifyOutput", () => {
  it("parses clean JSON", async () => {
    const { parseClassifyOutput } = await import("../classify");
    const result = parseClassifyOutput(JSON.stringify(FAKE_CLASSIFY_RESPONSE));
    expect(result.archetype).toBe("supplier");
  });

  it("strips markdown fences", async () => {
    const { parseClassifyOutput } = await import("../classify");
    const raw = "```json\n" + JSON.stringify(FAKE_CLASSIFY_RESPONSE) + "\n```";
    const result = parseClassifyOutput(raw);
    expect(result.archetype).toBe("supplier");
  });

  it("throws on invalid archetype", async () => {
    const { parseClassifyOutput } = await import("../classify");
    const bad = { ...FAKE_CLASSIFY_RESPONSE, archetype: "invalid_archetype" };
    expect(() => parseClassifyOutput(JSON.stringify(bad))).toThrow();
  });
});
