/**
 * sprintStore — Zustand store for sprint snapshots (task 4.1)
 */

import { create } from "zustand";
import type { SprintSnapshot } from "../types/sprint.js";

export type { SprintSnapshot };

interface SprintState {
  snapshots: Map<string, SprintSnapshot>;
  selectedBoard: string | null;
  streamConnected: boolean;
  setSnapshot: (boardId: string, snap: SprintSnapshot) => void;
  selectBoard: (boardId: string) => void;
  setStreamConnected: (v: boolean) => void;
}

export const useSprintStore = create<SprintState>((set) => ({
  snapshots: new Map(),
  selectedBoard: null,
  streamConnected: false,

  setSnapshot: (boardId, snap) =>
    set((s) => {
      const next = new Map(s.snapshots);
      next.set(boardId, snap);
      return { snapshots: next };
    }),

  selectBoard: (boardId) => set({ selectedBoard: boardId }),

  setStreamConnected: (v) => set({ streamConnected: v }),
}));
