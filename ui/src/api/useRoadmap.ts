/**
 * React Query hooks for the roadmap API (task 4.2)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client.js";
import { useRoadmapStore } from "../stores/roadmapStore.js";
import type {
  RoadmapSnapshot,
  Epic,
  Milestone,
  DependencyEdge,
  RICEScore,
} from "../types/roadmap.js";

// ─── useRoadmap ────────────────────────────────────────────────────────────

export function useRoadmap(projectKey: string | null) {
  const setSnapshot = useRoadmapStore((s) => s.setSnapshot);
  return useQuery({
    queryKey: ["roadmap", "snapshot", projectKey],
    queryFn: async () => {
      if (!projectKey) return null;
      const r = await apiFetch<{ ok: true; data: RoadmapSnapshot }>(
        `/api/roadmap/${projectKey}/snapshot`,
      );
      if (!r.ok) throw new Error(r.error.message);
      setSnapshot(projectKey, r.data.data);
      return r.data.data;
    },
    enabled: Boolean(projectKey),
    staleTime: 60_000,
  });
}

// ─── useEpic ───────────────────────────────────────────────────────────────

export function useEpic(projectKey: string | null, epicKey: string | null) {
  return useQuery({
    queryKey: ["roadmap", "epic", projectKey, epicKey],
    queryFn: async () => {
      if (!projectKey || !epicKey) return null;
      const r = await apiFetch<{ ok: true; data: Epic }>(
        `/api/roadmap/${projectKey}/epics/${epicKey}`,
      );
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    enabled: Boolean(projectKey && epicKey),
    staleTime: 30_000,
  });
}

// ─── useMilestones ─────────────────────────────────────────────────────────

export function useMilestones(projectKey: string | null) {
  return useQuery({
    queryKey: ["roadmap", "milestones", projectKey],
    queryFn: async () => {
      if (!projectKey) return [] as Milestone[];
      const r = await apiFetch<{ ok: true; data: Milestone[] }>(
        `/api/roadmap/${projectKey}/milestones`,
      );
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    enabled: Boolean(projectKey),
    staleTime: 60_000,
  });
}

// ─── useDependencies ───────────────────────────────────────────────────────

export function useDependencies(projectKey: string | null) {
  return useQuery({
    queryKey: ["roadmap", "dependencies", projectKey],
    queryFn: async () => {
      if (!projectKey) return [] as DependencyEdge[];
      const r = await apiFetch<{ ok: true; data: DependencyEdge[] }>(
        `/api/roadmap/${projectKey}/dependencies`,
      );
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    enabled: Boolean(projectKey),
    staleTime: 60_000,
  });
}

// ─── useRefreshRoadmap ─────────────────────────────────────────────────────

export function useRefreshRoadmap(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await apiFetch<{ ok: true }>(`/api/roadmap/${projectKey}/refresh`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(r.error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roadmap", "snapshot", projectKey] });
      qc.invalidateQueries({ queryKey: ["roadmap", "milestones", projectKey] });
      qc.invalidateQueries({ queryKey: ["roadmap", "dependencies", projectKey] });
    },
  });
}

// ─── usePatchEpicRICE ─────────────────────────────────────────────────────

export function usePatchEpicRICE(projectKey: string, epicKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (overrides: Partial<RICEScore>) => {
      const r = await apiFetch<{ ok: true; data: Epic }>(
        `/api/roadmap/${projectKey}/epics/${epicKey}/rice`,
        { method: "PATCH", body: JSON.stringify(overrides) },
      );
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roadmap", "snapshot", projectKey] });
      qc.invalidateQueries({ queryKey: ["roadmap", "epic", projectKey, epicKey] });
    },
  });
}
