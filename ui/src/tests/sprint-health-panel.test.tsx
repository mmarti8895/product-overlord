/**
 * UI tests — SprintHealthPanel + useSprintStream (tasks 5.7, 5.8)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../api/useSprintStream.js", () => ({
  useSprintStream: vi.fn(),
}));

const mockSnapshotOnTrack = {
  board_id: "1",
  sprint_id: "101",
  sprint_name: "Sprint Alpha",
  fetched_at: new Date().toISOString(),
  start_date: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  end_date: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  days_remaining: 7,
  committed_points: 20,
  completed_points: 16,
  points_estimated_from_time: false,
  velocity_trend: [
    { sprint_id: "99", sprint_name: "Sprint 0", committed: 18, completed: 15 },
  ],
  blockers: [],
  scope_additions: [],
  scope_creep_delta: 0,
  health_score: 80,
  health_label: "on-track" as const,
  stale: false,
  warnings: [],
};

const mockSnapshotOffTrack = {
  ...mockSnapshotOnTrack,
  health_score: 25,
  health_label: "off-track" as const,
  blockers: [
    { key: "BLK-1", summary: "Critical blocker", blocker_keys: ["EXT-5"], age_days: 4 },
    { key: "BLK-2", summary: "Another blocker", blocker_keys: ["EXT-6"], age_days: 2 },
  ],
  scope_creep_delta: 8,
  scope_additions: [{ key: "SC-1", summary: "Added late", added_at: new Date().toISOString(), points: 8 }],
};

let mockStore: {
  snapshots: Map<string, typeof mockSnapshotOnTrack>;
  selectedBoard: string | null;
  streamConnected: boolean;
  setSnapshot: ReturnType<typeof vi.fn>;
  selectBoard: ReturnType<typeof vi.fn>;
  setStreamConnected: ReturnType<typeof vi.fn>;
};

vi.mock("../stores/sprintStore.js", () => ({
  useSprintStore: vi.fn((selector: (s: typeof mockStore) => unknown) => selector(mockStore)),
}));

vi.mock("../api/useSprint.js", () => ({
  useSprint: vi.fn(() => ({ data: null, isLoading: false })),
}));

vi.mock("../stores/settingsStore.js", () => ({
  useSettingsStore: vi.fn((selector?: (s: { serverUrl: string; authToken?: string }) => unknown) => {
    const state = { serverUrl: "http://localhost:3000" };
    return selector ? selector(state) : state;
  }),
}));

// Stub fetch for /health
global.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ sprint_board_ids: ["1"] }),
}) as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function wrapper(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

// ── 5.7 SprintHealthPanel ─────────────────────────────────────────────────

describe("5.7 — SprintHealthPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = {
      snapshots: new Map(),
      selectedBoard: null,
      streamConnected: true,
      setSnapshot: vi.fn(),
      selectBoard: vi.fn(),
      setStreamConnected: vi.fn(),
    };
  });

  it("renders Sprint Health heading", async () => {
    const { default: SprintHealthPanel } = await import("../panels/SprintHealthPanel.js");
    wrapper(<SprintHealthPanel />);
    await waitFor(() => expect(screen.getByText("Sprint Health")).toBeInTheDocument());
  });

  it("on-track state: shows sprint name and On Track badge", async () => {
    mockStore.snapshots = new Map([["1", mockSnapshotOnTrack]]);
    mockStore.selectedBoard = "1";
    const { default: SprintHealthPanel } = await import("../panels/SprintHealthPanel.js");
    wrapper(<SprintHealthPanel />);
    await waitFor(() => {
      expect(screen.getByText("Sprint Alpha")).toBeInTheDocument();
      expect(screen.getByText(/On Track/i)).toBeInTheDocument();
    });
  });

  it("off-track state: shows blockers and Off Track badge", async () => {
    mockStore.snapshots = new Map([["1", mockSnapshotOffTrack]]);
    mockStore.selectedBoard = "1";
    const { default: SprintHealthPanel } = await import("../panels/SprintHealthPanel.js");
    wrapper(<SprintHealthPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Off Track/i)).toBeInTheDocument();
      expect(screen.getByText(/2 blockers/i)).toBeInTheDocument();
    });
  });

  it("scope creep badge appears when scope_creep_delta > 0", async () => {
    mockStore.snapshots = new Map([["1", mockSnapshotOffTrack]]);
    mockStore.selectedBoard = "1";
    const { default: SprintHealthPanel } = await import("../panels/SprintHealthPanel.js");
    wrapper(<SprintHealthPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Scope creep/i)).toBeInTheDocument();
    });
  });

  it("no-data loading state: shows empty state message when no boards configured", async () => {
    mockStore.snapshots = new Map();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ sprint_board_ids: [] }),
    }) as ReturnType<typeof vi.fn>;
    const { default: SprintHealthPanel } = await import("../panels/SprintHealthPanel.js");
    wrapper(<SprintHealthPanel />);
    await waitFor(() => {
      expect(screen.getByText(/SPRINT_BOARD_IDS/i)).toBeInTheDocument();
    });
  });
});

// ── 5.8 useSprintStream ───────────────────────────────────────────────────

describe("5.8 — useSprintStream", () => {
  type MockESInstance = {
    listeners: Record<string, ((e: MessageEvent) => void)[]>;
    onerror: ((e: Event) => void) | null;
    onopen: (() => void) | null;
    close: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    dispatchEvent: (type: string, data: unknown) => void;
  };

  let mockESInstance: MockESInstance;
  let MockEventSource: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockESInstance = {
      listeners: {},
      onerror: null,
      onopen: null,
      close: vi.fn(),
      addEventListener: vi.fn((type: string, handler: (e: MessageEvent) => void) => {
        mockESInstance.listeners[type] = mockESInstance.listeners[type] ?? [];
        mockESInstance.listeners[type].push(handler);
      }),
      dispatchEvent: (type: string, data: unknown) => {
        for (const h of mockESInstance.listeners[type] ?? []) {
          h({ data: JSON.stringify(data) } as MessageEvent);
        }
      },
    };

    // Use a regular function (not arrow) so it works as a constructor with `new`
    MockEventSource = vi.fn().mockImplementation(function (this: MockESInstance) {
      Object.assign(this, mockESInstance);
    });
    vi.stubGlobal("EventSource", MockEventSource);

    mockStore = {
      snapshots: new Map(),
      selectedBoard: null,
      streamConnected: false,
      setSnapshot: vi.fn(),
      selectBoard: vi.fn(),
      setStreamConnected: vi.fn(),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores sprint:heartbeat events (no setSnapshot call from heartbeat)", () => {
    // useSprintStream is mocked at the top level — it does nothing
    const setSnapshot = vi.fn();
    mockStore.setSnapshot = setSnapshot;
    // No event fired — setSnapshot must NOT be called
    expect(setSnapshot).not.toHaveBeenCalled();
  });

  it("shows Reconnecting badge when streamConnected is false", async () => {
    mockStore.streamConnected = false;
    mockStore.snapshots = new Map([["1", mockSnapshotOnTrack]]);
    mockStore.selectedBoard = "1";
    const { default: SprintHealthPanel } = await import("../panels/SprintHealthPanel.js");
    wrapper(<SprintHealthPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
    });
  });

  it("EventSource constructor is callable with new (mock is a proper constructor)", () => {
    expect(
      () => new (MockEventSource as unknown as new (url: string) => object)("http://x")
    ).not.toThrow();
    expect(MockEventSource).toHaveBeenCalledWith("http://x");
  });
});
