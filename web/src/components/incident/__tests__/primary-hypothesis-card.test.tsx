// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PrimaryHypothesisCard } from "../primary-hypothesis-card";
import { sampleHypotheses, sampleSignals } from "./fixtures";

afterEach(() => cleanup());

describe("PrimaryHypothesisCard", () => {
  it("renders the title, confidence percentage and supporting count", () => {
    render(
      <PrimaryHypothesisCard
        hypothesis={sampleHypotheses[0]}
        problemStatement="Cluster of 17 signals point at PM-00008 supplier batch SB-00007."
        signals={sampleSignals}
      />,
    );
    expect(screen.getByText(sampleHypotheses[0].title)).toBeTruthy();
    expect(screen.getByText(/82/)).toBeTruthy();
    expect(screen.getByTestId("evidence-count").textContent).toContain("3");
  });

  it("opens the evidence trail by default when >= 3 signals supporting", () => {
    render(
      <PrimaryHypothesisCard
        hypothesis={sampleHypotheses[0]}
        problemStatement="x"
        signals={sampleSignals}
      />,
    );
    expect(screen.getByTestId("evidence-trail")).toBeTruthy();
    expect(screen.getByText(/SIG-408/)).toBeTruthy();
  });

  it("can collapse the evidence trail via the toggle", () => {
    render(
      <PrimaryHypothesisCard
        hypothesis={sampleHypotheses[0]}
        problemStatement="x"
        signals={sampleSignals}
      />,
    );
    const toggle = screen.getByRole("button", { name: /Hide evidence trail/i });
    fireEvent.click(toggle);
    expect(screen.queryByTestId("evidence-trail")).toBeNull();
  });

  it("opens a signal drawer when clicking an evidence row", () => {
    render(
      <PrimaryHypothesisCard
        hypothesis={sampleHypotheses[0]}
        problemStatement="x"
        signals={sampleSignals}
      />,
    );
    const sigButton = screen.getByText(/Batch SB-00007 caps measured/i);
    fireEvent.click(sigButton);
    // dialog appears
    expect(screen.getByRole("dialog", { name: /Signal SIG-411/i })).toBeTruthy();
  });

  it("renders gracefully when no supporting evidence", () => {
    const empty = { ...sampleHypotheses[2] };
    render(
      <PrimaryHypothesisCard
        hypothesis={empty}
        problemStatement="x"
        signals={sampleSignals}
      />,
    );
    expect(screen.queryByTestId("evidence-trail")).toBeNull();
    expect(screen.getByTestId("evidence-count").textContent).toContain("0");
  });
});
