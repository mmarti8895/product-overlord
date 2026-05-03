/**
 * roadmapStore — Zustand store for roadmap state (task 4.1)
 */

import { create } from "zustand";
import type { RoadmapSnapshot, Epic, Milestone, DependencyEdge } from "../types/roadmap.js";

interface RoadmapState {
  snapshots: Map<string, RoadmapSnapshot>;
  selectedProject: string | null;
  activeTab: "timeline" | "rice" | "graph";
  drawerEpicKey: string | null;

  setSnapshot: (projectKey: string, snap: RoadmapSnapshot) => void;
  selectProject: (projectKey: string) => void;
  setActiveTab: (tab: RoadmapState["activeTab"]) => void;
  openDrawer: (epicKey: string) => void;
  closeDrawer: () => void;

  // Selectors
  getSnapshot: (projectKey: string) => RoadmapSnapshot | undefined;
  getEpics: (projectKey: string) => Epic[];
  getMilestones: (projectKey: string) => Milestone[];
  getDependencies: (projectKey: string) => DependencyEdge[];
}

export const useRoadmapStore = create<RoadmapState>((set, get) => ({
  snapshots: new Map(),
  selectedProject: null,
  activeTab: "timeline",
  drawerEpicKey: null,

  setSnapshot: (projectKey, snap) =>
    set((s) => {
      const next = new Map(s.snapshots);
      next.set(projectKey, snap);
      return { snapshots: next };
    }),

  selectProject: (projectKey) => set({ selectedProject: projectKey }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  openDrawer: (epicKey) => set({ drawerEpicKey: epicKey }),
  closeDrawer: () => set({ drawerEpicKey: null }),

  getSnapshot: (projectKey) => get().snapshots.get(projectKey),
  getEpics: (projectKey) => get().snapshots.get(projectKey)?.epics ?? [],
  getMilestones: (projectKey) => get().snapshots.get(projectKey)?.milestones ?? [],
  getDependencies: (projectKey) => get().snapshots.get(projectKey)?.dependency_graph ?? [],
}));
