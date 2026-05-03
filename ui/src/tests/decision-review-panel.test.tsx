/**
 * UI unit tests — DecisionReviewPanel (13.9)
 * Tests approve / reject / modify flows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Decision } from "../stores/decisionsStore.js";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockApprove = vi.fn();
const mockReject = vi.fn();
const mockModify = vi.fn();

vi.mock("../api/queries/agentHooks.js", () => ({
  useDecisionsStream: vi.fn(),
  useApproveDecision: vi.fn(() => ({ mutate: mockApprove, isPending: false })),
  useRejectDecision: vi.fn(() => ({ mutate: mockReject, isPending: false })),
  useModifyDecision: vi.fn(() => ({ mutate: mockModify, isPending: false })),
}));

const pendingDecision: Decision = {
  id: "d-001",
  agent: "test-agent",
  run_id: "run-001",
  type: "plan_step",
  payload: { action: "search_jira", query: "open bugs" },
  requires_review: true,
  created_at: new Date().toISOString(),
  status: "pending",
};

vi.mock("../stores/decisionsStore.js", () => ({
  useDecisionsStore: vi.fn((selector: (s: { decisions: Decision[] }) => unknown) =>
    selector({ decisions: [pendingDecision] })
  ),
  useDecisionsPendingCount: vi.fn(() => 1),
}));

vi.mock("react-json-view-lite", () => ({
  JsonView: ({ data }: { data: unknown }) => <pre data-testid="json-view">{JSON.stringify(data)}</pre>,
  allExpanded: () => true,
  defaultStyles: {},
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

async function renderPanel() {
  const { default: DecisionReviewPanel } = await import("../panels/DecisionReviewPanel.js");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DecisionReviewPanel />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("13.9 — DecisionReviewPanel", () => {
  beforeEach(() => {
    mockApprove.mockReset();
    mockReject.mockReset();
    mockModify.mockReset();
  });

  it("renders pending decision heading", async () => {
    await renderPanel();
    await waitFor(() => {
      expect(screen.getByText(/Decision Review/i)).toBeInTheDocument();
    });
  });

  it("displays agent name", async () => {
    await renderPanel();
    await waitFor(() => {
      expect(screen.getByText("test-agent")).toBeInTheDocument();
    });
  });

  it("shows approve button for pending decision", async () => {
    await renderPanel();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    });
  });

  it("shows reject button for pending decision", async () => {
    await renderPanel();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
    });
  });

  it("calls approve mutate when Approve is clicked", async () => {
    await renderPanel();
    await waitFor(() => screen.getByRole("button", { name: /approve/i }));
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(mockApprove).toHaveBeenCalledWith("d-001");
  });

  it("calls reject mutate when Reject is clicked", async () => {
    await renderPanel();
    await waitFor(() => screen.getByRole("button", { name: /reject/i }));
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(mockReject).toHaveBeenCalledWith({ id: "d-001", reason: undefined });
  });

  it("shows pending count badge", async () => {
    await renderPanel();
    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("renders JSON payload view", async () => {
    await renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("json-view")).toBeInTheDocument();
    });
  });
});
