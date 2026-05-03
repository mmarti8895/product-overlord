/**
 * UI unit tests — WorkflowPanel (13.11)
 * Tests plan-mode toggle, stage selection, Run and Stop controls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockRunMutateAsync  = vi.fn().mockResolvedValue({ run_id: "run-abc-1234" });
const mockPlanMutateAsync = vi.fn().mockResolvedValue({ stages: [], estimated_tokens: 500, estimated_cost_usd: 0.01 });
const mockStopMutate      = vi.fn();
const mockPush            = vi.fn();

vi.mock("../api/queries/agentHooks.js", () => ({
  useWorkflowRuns:       vi.fn(() => ({ data: [] })),
  useWorkflowSchedules:  vi.fn(() => ({ data: [] })),
  useRunWorkflow:        vi.fn(() => ({ mutateAsync: mockRunMutateAsync, isPending: false })),
  usePlanWorkflow:       vi.fn(() => ({ mutateAsync: mockPlanMutateAsync, isPending: false })),
  useStopWorkflow:       vi.fn(() => ({ mutate: mockStopMutate, isPending: false })),
  useUpsertSchedule:     vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useSaveSchedule:       vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false })),
  useDeleteSchedule:     vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock("../stores/workflowStore.js", async (importOrig) => {
  const actual = await importOrig<typeof import("../stores/workflowStore.js")>();
  let selectedStages = [...actual.DEFAULT_STAGES];
  let planResult: unknown = null;
  return {
    ...actual,
    useWorkflowStore: vi.fn(() => ({
      selectedStages,
      setSelectedStages: vi.fn((s: string[]) => { selectedStages = s; }),
      planResult,
      setPlanResult: vi.fn((r: unknown) => { planResult = r; }),
      runs: [],
      schedules: [],
    })),
  };
});

vi.mock("../components/glass/GlassToast.js", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useToastStore: vi.fn((sel: any) => sel({ push: mockPush })),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function wrapper(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("13.11 — WorkflowPanel", () => {
  beforeEach(() => {
    mockRunMutateAsync.mockReset().mockResolvedValue({ run_id: "run-abc-1234" });
    mockPlanMutateAsync.mockReset().mockResolvedValue({ stages: [], estimated_tokens: 500, estimated_cost_usd: 0.01 });
    mockStopMutate.mockReset();
    mockPush.mockReset();
    vi.resetModules();
  });

  it("renders the Workflows heading", async () => {
    const { default: WorkflowPanel } = await import("../panels/WorkflowPanel.js");
    wrapper(<WorkflowPanel />);
    expect(screen.getByText(/Workflows/i)).toBeInTheDocument();
  });

  it("renders Pipeline and Schedule tabs", async () => {
    const { default: WorkflowPanel } = await import("../panels/WorkflowPanel.js");
    wrapper(<WorkflowPanel />);
    expect(screen.getByRole("button", { name: /pipeline/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /schedule/i })).toBeInTheDocument();
  });

  it("shows pipeline stages as checkboxes", async () => {
    const { default: WorkflowPanel } = await import("../panels/WorkflowPanel.js");
    wrapper(<WorkflowPanel />);
    const checkboxes = screen.getAllByRole("checkbox");
    // pipeline stage checkboxes + plan-mode checkbox
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it("Plan mode checkbox is initially unchecked", async () => {
    const { default: WorkflowPanel } = await import("../panels/WorkflowPanel.js");
    wrapper(<WorkflowPanel />);
    const planCheckbox = screen.getByRole("checkbox", { name: /plan mode/i });
    expect(planCheckbox).not.toBeChecked();
  });

  it("enables Plan mode toggle and shows Estimate Cost button", async () => {
    const { default: WorkflowPanel } = await import("../panels/WorkflowPanel.js");
    wrapper(<WorkflowPanel />);
    const planCheckbox = screen.getByRole("checkbox", { name: /plan mode/i });
    await userEvent.click(planCheckbox);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /estimate cost/i }).length).toBeGreaterThan(0);
    });
  });

  it("Run Now button triggers runWorkflow mutateAsync", async () => {
    const { default: WorkflowPanel } = await import("../panels/WorkflowPanel.js");
    wrapper(<WorkflowPanel />);
    const runBtn = screen.getByRole("button", { name: /run now/i });
    await userEvent.click(runBtn);
    await waitFor(() => {
      expect(mockRunMutateAsync).toHaveBeenCalledOnce();
    });
  });

  it("Estimate Cost button triggers planWorkflow mutateAsync", async () => {
    const { default: WorkflowPanel } = await import("../panels/WorkflowPanel.js");
    wrapper(<WorkflowPanel />);
    // Enable plan mode
    const planCheckbox = screen.getByRole("checkbox", { name: /plan mode/i });
    await userEvent.click(planCheckbox);
    const estimateBtn = screen.getAllByRole("button", { name: /estimate cost/i })[0];
    await userEvent.click(estimateBtn);
    await waitFor(() => {
      expect(mockPlanMutateAsync).toHaveBeenCalledOnce();
    });
  });

  it("Select All fills selectedStages; Clear empties them", async () => {
    const { default: WorkflowPanel } = await import("../panels/WorkflowPanel.js");
    const { useWorkflowStore } = await import("../stores/workflowStore.js");
    const setSelectedStages = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useWorkflowStore as any).mockReturnValue({
      selectedStages: [],
      setSelectedStages,
      planResult: null,
      setPlanResult: vi.fn(),
      runs: [],
      schedules: [],
    });
    wrapper(<WorkflowPanel />);
    await userEvent.click(screen.getByRole("button", { name: /select all/i }));
    expect(setSelectedStages).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(setSelectedStages).toHaveBeenCalledWith([]);
  });

  it("switching to Schedule tab shows ScheduleBuilder", async () => {
    const { default: WorkflowPanel } = await import("../panels/WorkflowPanel.js");
    wrapper(<WorkflowPanel />);
    await userEvent.click(screen.getByRole("button", { name: /schedule/i }));
    await waitFor(() => {
      // ScheduleBuilder renders "⏰ Schedule" heading and a "Cron:" label
      expect(screen.getByText(/Save Schedule/i)).toBeInTheDocument();
    });
  });
});
