// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(() => cleanup());

const pushed: string[] = [];
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (href: string) => pushed.push(href) }),
  useSearchParams: () => new URLSearchParams("lens=engineer&window=7d"),
  usePathname: () => "/inbox",
}));

import { FilterStrip } from "../filter-strip";

describe("FilterStrip", () => {
  it("renders the four filter pills", () => {
    render(<FilterStrip />);
    expect(screen.getByText(/All archetypes/)).toBeTruthy();
    expect(screen.getByText(/Last 7d/)).toBeTruthy();
    expect(screen.getByText(/All products/)).toBeTruthy();
    expect(screen.getByText(/All severities/)).toBeTruthy();
  });

  it("clicking a window option pushes a new URL with window=", () => {
    pushed.length = 0;
    render(<FilterStrip />);
    fireEvent.click(screen.getByText(/Last 7d/));
    fireEvent.click(screen.getByText("Last 1d"));
    expect(pushed[0]).toContain("window=1d");
  });
});
