// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { InitiativesPreview } from "../initiatives-preview";
import { sampleInitiatives } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => cleanup());

describe("InitiativesPreview — dispatch flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("idle → click dispatch → fetch called → success state shown", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ initiative: {}, product_action_id: "PA-00001" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <InitiativesPreview initiatives={sampleInitiatives} incidentId="INC-1" />,
    );

    const btn = screen.getByTestId("dispatch-button");
    expect(btn.textContent).toMatch(/Dispatch selected \(2\)/);

    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByTestId("dispatch-success")).toBeTruthy();
    });

    // fetch called once per approved initiative (2 total, both approved by default)
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/initiative/approve",
      expect.objectContaining({ method: "POST" }),
    );

    // Success message
    expect(screen.getByText(/2 initiatives created/)).toBeTruthy();

    // View kanban link shown
    expect(screen.getByTestId("view-kanban-link")).toBeTruthy();
  });

  it("shows error inline when fetch returns non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "product_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <InitiativesPreview initiatives={sampleInitiatives} incidentId="INC-1" />,
    );

    const btn = screen.getByTestId("dispatch-button");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByTestId("dispatch-error")).toBeTruthy();
    });

    expect(screen.getByText(/product_id is required/)).toBeTruthy();
  });

  it("dispatch button is disabled when no initiatives are approved", () => {
    render(
      <InitiativesPreview initiatives={sampleInitiatives} incidentId="INC-1" />,
    );

    // Uncheck all
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    for (const cb of checkboxes) {
      if (cb.checked) fireEvent.click(cb);
    }

    const btn = screen.getByTestId("dispatch-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
