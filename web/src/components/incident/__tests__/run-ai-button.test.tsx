// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { RunAiButton } from "../run-ai-button";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RunAiButton", () => {
  it("renders in idle state with correct label", () => {
    render(<RunAiButton incidentId="INC-001" />);
    expect(screen.getByRole("button").textContent).toContain("Run AI");
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
  });

  it("goes to dispatching state on click and disables button", async () => {
    // Fetch that never resolves
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    render(<RunAiButton incidentId="INC-001" />);
    const btn = screen.getByRole("button");

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(screen.getByRole("button").textContent).toContain("Running");
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });

  it("transitions to done when fetch resolves with 202", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 202,
          json: async () => ({ session_id: "sess-1" }),
        }),
      ),
    );

    render(<RunAiButton incidentId="INC-001" />);
    const btn = screen.getByRole("button");

    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() =>
      expect(screen.getByRole("button").textContent).toContain("Dispatched"),
    );
  });

  it("transitions to error state when fetch returns non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ code: "session_already_running" }),
        }),
      ),
    );

    render(<RunAiButton incidentId="INC-001" />);
    const btn = screen.getByRole("button");

    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() =>
      expect(screen.getByRole("button").textContent).toContain("Error"),
    );
  });

  it("transitions to error state when fetch throws a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network error"))),
    );

    render(<RunAiButton incidentId="INC-001" />);
    const btn = screen.getByRole("button");

    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() =>
      expect(screen.getByRole("button").textContent).toContain("Error"),
    );
  });
});
