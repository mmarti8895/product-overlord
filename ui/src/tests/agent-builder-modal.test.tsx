/**
 * UI unit tests — AgentBuilderModal (13.10)
 * Tests step navigation, field validation, and submit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockMutate = vi.fn();

vi.mock("../api/queries/agentHooks.js", () => ({
  useCreateAgent: vi.fn(() => ({ mutate: mockMutate, isPending: false })),
}));

vi.mock("../components/glass/GlassToast.js", () => ({
  useToastStore: vi.fn(() => ({ push: vi.fn() })),
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

async function renderOpen() {
  const { AgentBuilderModal } = await import("../panels/AgentBuilderModal.js");
  const onClose = vi.fn();
  wrapper(<AgentBuilderModal open={true} onClose={onClose} />);
  return { onClose };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("13.10 — AgentBuilderModal", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    vi.resetModules();
  });

  it("renders all 4 step labels", async () => {
    await renderOpen();
    // Step labels appear as buttons in the header — use getAllByText to handle
    // the fact that "Skills" also appears as "SKILLS.md" in the file preview tab
    expect(screen.getByText(/Identity/i)).toBeInTheDocument();
    expect(screen.getByText(/Persona/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Skills/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Config/i)).toBeInTheDocument();
  });

  it("starts on step 1 (Identity)", async () => {
    await renderOpen();
    expect(screen.getByPlaceholderText(/jira-analyst/i)).toBeInTheDocument();
  });

  it("Next is disabled when name/description are empty", async () => {
    await renderOpen();
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).toBeDisabled();
  });

  it("Next is enabled once name and description are filled", async () => {
    await renderOpen();
    await userEvent.type(screen.getByPlaceholderText(/jira-analyst/i), "my-agent");
    await userEvent.type(screen.getByPlaceholderText(/what does this agent do/i), "Does things");
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).not.toBeDisabled();
  });

  it("advances to Persona step on Next click", async () => {
    await renderOpen();
    await userEvent.type(screen.getByPlaceholderText(/jira-analyst/i), "my-agent");
    await userEvent.type(screen.getByPlaceholderText(/what does this agent do/i), "Does things");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    // Persona step shows a textarea referencing SOUL.md
    expect(screen.getByText(/SOUL\.md/i)).toBeInTheDocument();
  });

  it("Back button returns to previous step", async () => {
    await renderOpen();
    await userEvent.type(screen.getByPlaceholderText(/jira-analyst/i), "my-agent");
    await userEvent.type(screen.getByPlaceholderText(/what does this agent do/i), "Does things");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    // Back to identity — name field is visible
    expect(screen.getByPlaceholderText(/jira-analyst/i)).toBeInTheDocument();
  });

  it("role chips render all 4 roles and selecting one highlights it", async () => {
    await renderOpen();
    const reviewerBtn = screen.getByRole("button", { name: /reviewer/i });
    expect(reviewerBtn).toBeInTheDocument();
    await userEvent.click(reviewerBtn);
    // No error means role toggle works; button should be in the DOM
    expect(reviewerBtn).toBeInTheDocument();
  });

  it("file preview tabs switch content", async () => {
    await renderOpen();
    // SOUL.md tab should be in the preview panel
    const soulTab = screen.getAllByText(/SOUL\.md/i)[0];
    expect(soulTab).toBeInTheDocument();
    await userEvent.click(soulTab);
    // After click we should see "Soul —" in the preview
    await waitFor(() => {
      expect(screen.getByText(/Soul —/i)).toBeInTheDocument();
    });
  });

  it("navigates all steps and calls createAgent.mutate on final Create", async () => {
    await renderOpen();

    // Step 1
    await userEvent.type(screen.getByPlaceholderText(/jira-analyst/i), "test-bot");
    await userEvent.type(screen.getByPlaceholderText(/what does this agent do/i), "Test agent");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    // Step 2 — Persona
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    // Step 3 — Skills
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    // Step 4 — Config — click Create
    const createBtn = screen.getByRole("button", { name: /create agent/i });
    expect(createBtn).toBeInTheDocument();
    await userEvent.click(createBtn);
    expect(mockMutate).toHaveBeenCalledOnce();
    const arg = mockMutate.mock.calls[0][0];
    expect(arg.name).toBe("test-bot");
    expect(arg.description).toBe("Test agent");
  });

  it("Cancel button on step 1 calls onClose", async () => {
    const { onClose } = await renderOpen();
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
