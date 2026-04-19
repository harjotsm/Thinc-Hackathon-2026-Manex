// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { IncidentRow } from "../incident-row";
import type { IncidentListItem } from "@/server/incidents/loaders";

afterEach(() => cleanup());

const base: IncidentListItem = {
  incident_id: "INC-9F626BAFAB1E4B29A954",
  title: "Supplier batch SB-00007 — cold solder cluster",
  archetype: "unknown",
  severity: "high",
  primary_product_id: "PRD-00027",
  signal_count: 8,
  last_activity_at: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  confidence: 0.82,
  report_archetype: "supplier",
};

describe("IncidentRow", () => {
  it("renders title and sub-meta", () => {
    render(<IncidentRow incident={base} />);
    expect(screen.getByText("Supplier batch SB-00007 — cold solder cluster")).toBeTruthy();
    expect(screen.getByText(/PRD-00027/)).toBeTruthy();
    expect(screen.getByText(/8 signals/)).toBeTruthy();
  });

  it("severity dot uses #fb923c for high severity", () => {
    render(<IncidentRow incident={base} />);
    const dot = screen.getByTestId("severity-dot");
    expect(dot.style.background).toBe("rgb(251, 146, 60)"); // #fb923c
  });

  it("archetype pill shows report_archetype (supplier) overriding incident archetype (unknown)", () => {
    render(<IncidentRow incident={base} />);
    const pill = screen.getByTestId("archetype-pill");
    expect(pill.textContent?.toLowerCase()).toBe("supplier");
  });

  it("link href points to /incident/[id]", () => {
    render(<IncidentRow incident={base} />);
    const link = screen.getByTestId("incident-row");
    expect(link.getAttribute("href")).toBe(`/incident/${base.incident_id}`);
  });

  it("shows confidence percentage when available", () => {
    render(<IncidentRow incident={base} />);
    expect(screen.getByTestId("confidence").textContent).toBe("82%");
  });

  it("shows — when confidence is null", () => {
    render(<IncidentRow incident={{ ...base, confidence: null }} />);
    expect(screen.queryByTestId("confidence")).toBeNull();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("uses #cbd5e1 dot for null severity", () => {
    render(<IncidentRow incident={{ ...base, severity: null }} />);
    const dot = screen.getByTestId("severity-dot");
    expect(dot.style.background).toBe("rgb(203, 213, 225)"); // #cbd5e1
  });

  it("falls back to 'Untitled incident' when title is null", () => {
    render(<IncidentRow incident={{ ...base, title: null }} />);
    expect(screen.getByText("Untitled incident")).toBeTruthy();
  });
});
