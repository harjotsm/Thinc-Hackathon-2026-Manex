import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/anthropic", () => ({
  getAnthropicClient: () => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Untriaged · ESR readings off-spec" }],
      }),
    },
  }),
}));

import { themeTitle, clearTitleCache } from "../title";

describe("themeTitle", () => {
  beforeEach(() => clearTitleCache());

  it("returns deterministic template for known archetypes", async () => {
    const r = await themeTitle({ archetype: "supplier", dominantEntity: "PM-00008", signalTexts: [] });
    expect(r.title).toBe("Supplier · PM-00008");
    expect(r.source).toBe("template");
  });

  it("falls back to 'Untriaged' when LLM is unavailable for unknown", async () => {
    vi.doMock("@/lib/anthropic", () => ({ getAnthropicClient: () => null }));
    vi.resetModules();
    const { themeTitle: tt } = await import("../title");
    const r = await tt({ archetype: "unknown", dominantEntity: null, signalTexts: ["whatever"] });
    expect(r.source).toBe("fallback");
    expect(r.title).toBe("Untriaged");
  });

  it("calls LLM once per signature and caches", async () => {
    const r1 = await themeTitle({ archetype: "unknown", dominantEntity: null, signalTexts: ["ESR off-spec"] });
    const r2 = await themeTitle({ archetype: "unknown", dominantEntity: null, signalTexts: ["ESR off-spec"] });
    expect(r1.title).toBe(r2.title);
    expect(r1.source).toBe("llm");
  });
});
