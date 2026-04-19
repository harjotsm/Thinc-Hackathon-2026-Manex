import { describe, it, expect } from "vitest";
import { themeSchema, themesResponseSchema } from "../theme";

describe("themeSchema", () => {
  it("accepts a complete theme record", () => {
    const t = {
      signature: "supplier:PM-00008",
      archetype: "supplier",
      dominant_entity: "PM-00008",
      title: "Supplier · PM-00008",
      title_source: "template",
      incidents: [{
        incident_id: "INC-00001",
        title: "Cold solder cluster",
        severity: "high",
        last_activity_at: "2026-04-19T12:00:00Z",
        signal_count: 8,
      }],
      stats: { n_incidents: 1, n_signals: 8, n_sources: 3, products: ["PM-00008"], lines: [] },
      confidence_avg: 0.82,
      severity_max: "high",
      last_seen: "2026-04-19T12:00:00Z",
      related_signatures: [],
      signal_buckets_7d: [0, 1, 2, 3, 1, 0, 1],
    };
    expect(themeSchema.parse(t)).toMatchObject({ signature: "supplier:PM-00008" });
  });

  it("rejects unknown archetype", () => {
    const bad = { archetype: "weather" };
    const result = themeSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("themesResponseSchema requires themes array and lens", () => {
    const r = {
      themes: [],
      generated_at: "2026-04-19T12:00:00Z",
      window_days: 7,
      lens: "engineer",
    };
    expect(themesResponseSchema.parse(r).themes).toEqual([]);
  });
});
