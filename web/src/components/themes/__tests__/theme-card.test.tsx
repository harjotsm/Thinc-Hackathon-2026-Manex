// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeCard } from "../theme-card";
import type { Theme } from "@/server/schemas/theme";

const sample: Theme = {
  signature: "supplier:PM-00008",
  archetype: "supplier",
  dominant_entity: "PM-00008",
  title: "Supplier · PM-00008",
  title_source: "template",
  incidents: [
    { incident_id: "INC-00001", title: "Cold solder", severity: "high", last_activity_at: "2026-04-19T12:00:00Z", signal_count: 8 },
    { incident_id: "INC-00007", title: "ESR off-spec", severity: "medium", last_activity_at: "2026-04-19T11:00:00Z", signal_count: 5 },
  ],
  stats: { n_incidents: 2, n_signals: 13, n_sources: 3, products: ["PM-00008"], lines: [] },
  confidence_avg: 0.82,
  severity_max: "high",
  last_seen: "2026-04-19T12:00:00Z",
  related_signatures: [],
  signal_buckets_7d: [0, 1, 2, 3, 1, 0, 1],
};

describe("ThemeCard", () => {
  it("renders compact variant with archetype, title, drilldown link", () => {
    render(<ThemeCard theme={sample} />);
    expect(screen.getByText("supplier")).toBeTruthy();
    expect(screen.getByText("Supplier · PM-00008")).toBeTruthy();
    expect(screen.getByText(/2 incidents/)).toBeTruthy();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/incident/INC-00001");
  });

  it("renders expanded variant with incident chips and sparkline", () => {
    const { container } = render(<ThemeCard theme={sample} variant="expanded" />);
    expect(screen.getByText("INC-00001 · 8 sig")).toBeTruthy();
    expect(screen.getByText("INC-00007 · 5 sig")).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("shows 'Possibly related' chip when related_signatures non-empty", () => {
    render(<ThemeCard theme={{ ...sample, related_signatures: ["design:PM-00012"] }} />);
    expect(screen.getByText(/Possibly related/i)).toBeTruthy();
  });
});
