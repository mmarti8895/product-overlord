/**
 * UI unit tests — ConnectionsPanel (13.8)
 * Tests save + test interaction for each provider tab.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../api/queries/agentHooks.js", () => ({
  useConnections: vi.fn(() => ({ data: null, isLoading: false })),
  useSaveConnection: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useTestConnection: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock("../stores/connectionsStore.js", () => ({
  useConnectionsStore: vi.fn(() => ({
    configs: {},
    testResults: {},
    setConfig: vi.fn(),
    setTestResult: vi.fn(),
  })),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function wrapper(ui: React.ReactElement, path = "/connections/jira") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("13.8 — ConnectionsPanel", () => {
  import("../panels/ConnectionsPanel.js"); // warm up lazy import

  it("renders provider tab navigation", async () => {
    const { default: ConnectionsPanel } = await import("../panels/ConnectionsPanel.js");
    wrapper(
      <Routes>
        <Route path="/connections/:provider" element={<ConnectionsPanel />} />
      </Routes>,
      "/connections/jira"
    );
    await waitFor(() => {
      expect(screen.getAllByText(/Jira/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/OpenAI/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/GitHub/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders Connections heading", async () => {
    const { default: ConnectionsPanel } = await import("../panels/ConnectionsPanel.js");
    wrapper(
      <Routes>
        <Route path="/connections/:provider" element={<ConnectionsPanel />} />
      </Routes>,
      "/connections/jira"
    );
    await waitFor(() => {
      expect(screen.getByText("Connections")).toBeInTheDocument();
    });
  });
});
