// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Spark } from "../spark";

describe("Spark", () => {
  it("renders an SVG polyline with one point per data entry", () => {
    const { container } = render(<Spark data={[1, 2, 3, 4, 5]} />);
    const poly = container.querySelector("polyline");
    expect(poly).not.toBeNull();
    expect(poly!.getAttribute("points")!.split(" ")).toHaveLength(5);
  });

  it("includes a polygon when fill=true", () => {
    const { container } = render(<Spark data={[1, 2, 3]} fill />);
    expect(container.querySelector("polygon")).not.toBeNull();
  });

  it("renders nothing when data is empty", () => {
    const { container } = render(<Spark data={[]} />);
    expect(container.querySelector("polyline")).toBeNull();
  });
});
