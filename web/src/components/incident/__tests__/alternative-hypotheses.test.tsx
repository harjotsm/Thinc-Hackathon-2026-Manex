// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AlternativeHypotheses } from "../alternative-hypotheses";
import { sampleHypotheses } from "./fixtures";

afterEach(() => cleanup());

describe("AlternativeHypotheses", () => {
  it("renders one chip per non-primary hypothesis", () => {
    render(
      <AlternativeHypotheses
        hypotheses={sampleHypotheses}
        primaryId="HYP-1"
        onSelectPrimary={() => {}}
        incidentId="INC-1"
      />,
    );
    // primary HYP-1 is excluded; HYP-2 and HYP-3 are shown
    expect(screen.getByTestId("alternative-chip-HYP-2")).toBeTruthy();
    expect(screen.getByTestId("alternative-chip-HYP-3")).toBeTruthy();
    expect(screen.queryByTestId("alternative-chip-HYP-1")).toBeNull();
  });

  it("invokes onSelectPrimary when an alternative is clicked", () => {
    const fn = vi.fn();
    render(
      <AlternativeHypotheses
        hypotheses={sampleHypotheses}
        primaryId="HYP-1"
        onSelectPrimary={fn}
        incidentId="INC-1"
      />,
    );
    fireEvent.click(screen.getByTestId("alternative-chip-HYP-2"));
    expect(fn).toHaveBeenCalledWith("HYP-2");
  });

  it("returns nothing when only the primary exists", () => {
    const { container } = render(
      <AlternativeHypotheses
        hypotheses={[sampleHypotheses[0]]}
        primaryId="HYP-1"
        onSelectPrimary={() => {}}
        incidentId="INC-1"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("opens the explore-graph drawer when 'Explore as graph' clicked", () => {
    render(
      <AlternativeHypotheses
        hypotheses={sampleHypotheses}
        primaryId="HYP-1"
        onSelectPrimary={() => {}}
        incidentId="INC-1"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Explore hypotheses as graph/i }));
    expect(screen.getByRole("dialog", { name: /Explore hypotheses graph/i })).toBeTruthy();
  });
});
