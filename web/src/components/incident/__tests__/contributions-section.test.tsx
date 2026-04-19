// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ContributionsSection } from "../contributions-section";
import { sampleContributions } from "./fixtures";

afterEach(() => cleanup());

describe("ContributionsSection", () => {
  it("renders the first three contributions by default", () => {
    render(<ContributionsSection contributions={sampleContributions} />);
    expect(screen.getByTestId("contribution-CTB-001")).toBeTruthy();
    expect(screen.getByTestId("contribution-CTB-002")).toBeTruthy();
    expect(screen.getByTestId("contribution-CTB-003")).toBeTruthy();
    expect(screen.queryByTestId("contribution-CTB-004")).toBeNull();
  });

  it("expands to show all when 'Show all' clicked", () => {
    render(<ContributionsSection contributions={sampleContributions} />);
    fireEvent.click(screen.getByRole("button", { name: /Show all 4/i }));
    expect(screen.getByTestId("contribution-CTB-004")).toBeTruthy();
  });

  it("renders empty state when no contributions", () => {
    render(<ContributionsSection contributions={[]} />);
    expect(screen.getByTestId("contributions-empty")).toBeTruthy();
    expect(screen.getByText(/No contributions yet/i)).toBeTruthy();
  });
});
