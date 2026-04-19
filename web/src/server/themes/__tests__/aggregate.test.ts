import { describe, it, expect } from "vitest";
import { aggregateThemes, deriveDominantEntity, AggregatorIncidentInput } from "../aggregate";

const inc = (overrides: Partial<AggregatorIncidentInput> = {}): AggregatorIncidentInput => ({
  incident_id: "INC-00001",
  archetype: "supplier",
  primary_product_id: "PM-00008",
  primary_part_number: null,
  title: "Cold solder cluster",
  severity: "high",
  last_activity_at: "2026-04-19T12:00:00Z",
  signal_count: 8,
  centroid_embedding: null,
  source_count: 3,
  ...overrides,
});

describe("deriveDominantEntity", () => {
  it("prefers part_number for supplier and design", () => {
    expect(deriveDominantEntity({ ...inc(), archetype: "supplier", primary_part_number: "CAP-100uF" })).toBe("CAP-100uF");
    expect(deriveDominantEntity({ ...inc(), archetype: "design", primary_part_number: "R33" })).toBe("R33");
  });
  it("falls back to product_id when part_number missing", () => {
    expect(deriveDominantEntity({ ...inc(), archetype: "supplier", primary_part_number: null, primary_product_id: "PM-00008" })).toBe("PM-00008");
  });
  it("uses product_id for drift and operator", () => {
    expect(deriveDominantEntity({ ...inc(), archetype: "drift", primary_product_id: "PM-00003" })).toBe("PM-00003");
  });
  it("returns null for unknown archetype", () => {
    expect(deriveDominantEntity({ ...inc(), archetype: "unknown", primary_product_id: null })).toBeNull();
  });
});

describe("aggregateThemes", () => {
  it("collapses incidents sharing (archetype, dominant_entity)", () => {
    const themes = aggregateThemes([
      inc({ incident_id: "INC-1", archetype: "supplier", primary_product_id: "PM-00008", signal_count: 5 }),
      inc({ incident_id: "INC-2", archetype: "supplier", primary_product_id: "PM-00008", signal_count: 3 }),
      inc({ incident_id: "INC-3", archetype: "design", primary_product_id: "PM-00012", signal_count: 12 }),
    ]);
    expect(themes).toHaveLength(2);
    const supplier = themes.find((t) => t.signature === "supplier:PM-00008")!;
    expect(supplier.stats.n_incidents).toBe(2);
    expect(supplier.stats.n_signals).toBe(8);
    expect(supplier.incidents.map((i) => i.incident_id).sort()).toEqual(["INC-1", "INC-2"]);
  });

  it("orders themes by severity-then-recency desc", () => {
    const themes = aggregateThemes([
      inc({ incident_id: "INC-A", severity: "low",  primary_product_id: "P1", last_activity_at: "2026-04-19T13:00:00Z", signal_count: 1 }),
      inc({ incident_id: "INC-B", severity: "high", primary_product_id: "P2", last_activity_at: "2026-04-19T10:00:00Z", signal_count: 1 }),
      inc({ incident_id: "INC-C", severity: "high", primary_product_id: "P3", last_activity_at: "2026-04-19T11:00:00Z", signal_count: 1 }),
    ]);
    expect(themes.map((t) => t.signature)).toEqual([
      "supplier:P3", // high + later
      "supplier:P2", // high + earlier
      "supplier:P1", // low
    ]);
  });

  it("returns severity_max as the highest in the cluster", () => {
    const [theme] = aggregateThemes([
      inc({ incident_id: "INC-1", severity: "low" }),
      inc({ incident_id: "INC-2", severity: "high" }),
    ]);
    expect(theme.severity_max).toBe("high");
  });

  it("buckets a 7-day sparkline relative to a fixed now", () => {
    const now = new Date("2026-04-19T12:00:00Z");
    const themes = aggregateThemes(
      [
        inc({ incident_id: "INC-1", last_activity_at: "2026-04-19T11:00:00Z", signal_count: 3 }),
        inc({ incident_id: "INC-2", last_activity_at: "2026-04-17T11:00:00Z", signal_count: 5 }),
      ],
      { now },
    );
    // 7 buckets, last bucket (today) = 3, two days ago = 5
    expect(themes[0].signal_buckets_7d).toHaveLength(7);
    expect(themes[0].signal_buckets_7d[6]).toBe(3); // today
    expect(themes[0].signal_buckets_7d[4]).toBe(5); // 2 days ago
  });

  it("uses 'untriaged' signature for unknown archetype with null entity", () => {
    const [theme] = aggregateThemes([inc({ incident_id: "X", archetype: "unknown", primary_product_id: null, primary_part_number: null })]);
    expect(theme.signature).toBe("unknown:—");
    expect(theme.dominant_entity).toBeNull();
  });
});
