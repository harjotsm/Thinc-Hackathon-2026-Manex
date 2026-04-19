// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SimilarLessons } from "../similar-lessons";

afterEach(() => cleanup());

describe("SimilarLessons", () => {
  it("renders nothing when no lessons", () => {
    const { container } = render(<SimilarLessons lessons={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders up to three lesson cards with applied count", () => {
    render(
      <SimilarLessons
        lessons={[
          { lesson_id: "LES-018", signature: "supplier:PM-00008", applied_count: 4, trend: "down" },
          { lesson_id: "LES-019", signature: "design:MC-200", applied_count: 1, trend: "up" },
          { lesson_id: "LES-020", signature: "drift:Stn-04", applied_count: 2, trend: "flat" },
          { lesson_id: "LES-021", signature: "ignored", applied_count: 0 },
        ]}
      />,
    );
    expect(screen.getByTestId("lesson-card-LES-018")).toBeTruthy();
    expect(screen.getByTestId("lesson-card-LES-019")).toBeTruthy();
    expect(screen.getByTestId("lesson-card-LES-020")).toBeTruthy();
    expect(screen.queryByTestId("lesson-card-LES-021")).toBeNull();
    expect(screen.getByText(/Applied 4×/)).toBeTruthy();
  });
});
