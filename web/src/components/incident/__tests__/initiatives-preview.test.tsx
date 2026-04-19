// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { InitiativesPreview } from "../initiatives-preview";
import { sampleInitiatives } from "./fixtures";

afterEach(() => cleanup());

describe("InitiativesPreview", () => {
  it("renders one card per initiative with title and target system", () => {
    render(<InitiativesPreview initiatives={sampleInitiatives} incidentId="INC-1" />);
    expect(screen.getByTestId("initiative-card-0")).toBeTruthy();
    expect(screen.getByTestId("initiative-card-1")).toBeTruthy();
    expect(screen.getByText(/Quarantine SB-00007 batch/)).toBeTruthy();
    expect(screen.getByText(/MES/)).toBeTruthy();
    expect(screen.getByText(/SRM/)).toBeTruthy();
  });

  it("starts with all initiatives approved and counts them", () => {
    render(<InitiativesPreview initiatives={sampleInitiatives} incidentId="INC-1" />);
    expect(screen.getByText(/2 of 2 approved/)).toBeTruthy();
  });

  it("decrements approval count when a checkbox is unchecked", () => {
    render(<InitiativesPreview initiatives={sampleInitiatives} incidentId="INC-1" />);
    const cb = screen.getByLabelText(/Approve initiative Quarantine SB-00007 batch/i) as HTMLInputElement;
    fireEvent.click(cb);
    expect(cb.checked).toBe(false);
    expect(screen.getByText(/1 of 2 approved/)).toBeTruthy();
  });

  it("renders a friendly empty state when no initiatives", () => {
    render(<InitiativesPreview initiatives={[]} incidentId="INC-1" />);
    expect(screen.getByTestId("initiatives-preview-empty")).toBeTruthy();
    expect(screen.getByText(/AI will propose initiatives/i)).toBeTruthy();
  });
});
