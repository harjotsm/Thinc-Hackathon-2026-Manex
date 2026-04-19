// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CanvasHeader } from "../canvas-header";
import { sampleIncident } from "./fixtures";

afterEach(() => cleanup());

describe("CanvasHeader", () => {
  it("renders title, severity, archetype and signal counts", () => {
    render(
      <CanvasHeader
        incident={sampleIncident}
        signalCount={17}
        contributionCount={4}
        initiativeCount={2}
        hasPrimaryHypothesis
        hasEvidenceTrail
        hasRealContributions
        hasDispatchedInitiative={false}
        archetype="supplier"
        lastActivityAt="2026-04-19T04:00:00Z"
      />,
    );

    expect(screen.getByText(sampleIncident.title!)).toBeTruthy();
    expect(screen.getByText("high")).toBeTruthy();
    expect(screen.getByText("supplier")).toBeTruthy();
    expect(screen.getByText(/17 signals/)).toBeTruthy();
  });

  it("marks 'Detect' done and 'Find cause' current when hypothesis exists", () => {
    render(
      <CanvasHeader
        incident={sampleIncident}
        signalCount={3}
        contributionCount={0}
        initiativeCount={0}
        hasPrimaryHypothesis
        hasEvidenceTrail={false}
        hasRealContributions={false}
        hasDispatchedInitiative={false}
        archetype={null}
        lastActivityAt={null}
      />,
    );

    const detect = screen.getByTestId("phase-pill-detect");
    expect(detect.textContent).toContain("✓");
    const find = screen.getByTestId("phase-pill-find");
    expect(find.textContent).toContain("●");
  });

  it("marks suggest pending when no initiatives", () => {
    render(
      <CanvasHeader
        incident={sampleIncident}
        signalCount={0}
        contributionCount={0}
        initiativeCount={0}
        hasPrimaryHypothesis={false}
        hasEvidenceTrail={false}
        hasRealContributions={false}
        hasDispatchedInitiative={false}
        archetype={null}
        lastActivityAt={null}
      />,
    );
    const suggest = screen.getByTestId("phase-pill-suggest");
    expect(suggest.textContent).toContain("○");
  });
});
