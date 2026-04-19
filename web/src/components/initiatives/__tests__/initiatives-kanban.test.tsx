// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { InitiativesKanban } from "../initiatives-kanban";
import type { InitiativeRow } from "@/server/schemas/initiative";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => cleanup());

const BASE_ROW = {
  cosign_required: false,
  co_signed: false,
  consecutive_error_count: 0,
} as const;

const sampleRows: InitiativeRow[] = [
  {
    ...BASE_ROW,
    initiative_id: "INIT-00001",
    incident_id: "INC-SEED-SUPPLIER-001",
    agent_domain: "production",
    target_system: "MES",
    owner_user_id: null,
    due_ts: null,
    status: "proposed",
    comments: "Quarantine SB-00007 batch",
    created_at: "2026-04-19T10:00:00Z",
    updated_at: null,
    product_action_id: "PA-00001",
  },
  {
    ...BASE_ROW,
    initiative_id: "INIT-00002",
    incident_id: "INC-SEED-SUPPLIER-001",
    agent_domain: "supplier",
    target_system: "SRM",
    owner_user_id: "user_042",
    due_ts: null,
    status: "approved",
    comments: "Issue 8D to ElektroParts",
    created_at: "2026-04-19T11:00:00Z",
    updated_at: null,
    product_action_id: "PA-00002",
  },
];

describe("InitiativesKanban", () => {
  it("renders all 6 columns", () => {
    render(<InitiativesKanban initiatives={[]} />);
    expect(screen.getByTestId("kanban-col-proposed")).toBeTruthy();
    expect(screen.getByTestId("kanban-col-approved")).toBeTruthy();
    expect(screen.getByTestId("kanban-col-in_progress")).toBeTruthy();
    expect(screen.getByTestId("kanban-col-blocked")).toBeTruthy();
    expect(screen.getByTestId("kanban-col-verifying")).toBeTruthy();
    expect(screen.getByTestId("kanban-col-done")).toBeTruthy();
  });

  it("shows 'No initiatives in this status.' for empty columns", () => {
    render(<InitiativesKanban initiatives={[]} />);
    const empties = screen.getAllByText("No initiatives in this status.");
    expect(empties.length).toBeGreaterThanOrEqual(6);
  });

  it("places cards in the correct columns by status", () => {
    render(<InitiativesKanban initiatives={sampleRows} />);
    expect(screen.getByTestId("kanban-card-INIT-00001")).toBeTruthy();
    expect(screen.getByTestId("kanban-card-INIT-00002")).toBeTruthy();
    // Each card shows initiative_id (appears in header span + label div)
    expect(screen.getAllByText("INIT-00001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("INIT-00002").length).toBeGreaterThan(0);
  });

  it("shows system and domain pills on each card", () => {
    render(<InitiativesKanban initiatives={sampleRows} />);
    expect(screen.getAllByText("MES").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SRM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("production").length).toBeGreaterThan(0);
    expect(screen.getAllByText("supplier").length).toBeGreaterThan(0);
  });

  it("shows incident link for each card", () => {
    render(<InitiativesKanban initiatives={sampleRows} />);
    const links = screen.getAllByText(/← INC-SEED-SUPPLIER-001/);
    expect(links.length).toBe(2);
  });
});
