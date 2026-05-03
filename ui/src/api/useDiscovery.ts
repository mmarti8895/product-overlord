/**
 * React Query hooks for the discovery API (tasks 6.2)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client.js";
import type { FeedbackTheme, OpportunityCandidate } from "../types/discovery.js";

export function useDiscoveryThemes() {
  return useQuery({
    queryKey: ["discovery", "themes"],
    queryFn: async () => {
      const r = await apiFetch<{ ok: true; data: FeedbackTheme[] }>("/api/discovery/themes");
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    staleTime: 60_000,
  });
}

export function useDiscoveryTheme(id: string | null) {
  return useQuery({
    queryKey: ["discovery", "theme", id],
    queryFn: async () => {
      if (!id) return null;
      const r = await apiFetch<{ ok: true; data: FeedbackTheme }>(`/api/discovery/themes/${id}`);
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useOpportunityCandidates() {
  return useQuery({
    queryKey: ["discovery", "candidates"],
    queryFn: async () => {
      const r = await apiFetch<{ ok: true; data: OpportunityCandidate[] }>("/api/discovery/candidates");
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    staleTime: 30_000,
  });
}

export function useDiscoverySyncTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await apiFetch<{ ok: true }>("/api/discovery/sync", { method: "POST" });
      if (!r.ok) throw new Error(r.error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discovery"] });
    },
  });
}

export function usePromoteCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts: { id: string; project_key: string; title: string; description: string }) => {
      const { id, ...body } = opts;
      const r = await apiFetch<{ ok: true; data: OpportunityCandidate }>(
        `/api/discovery/candidates/${id}/promote`,
        { method: "POST", body: JSON.stringify(body) },
      );
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discovery", "candidates"] }),
  });
}

export function useDismissCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts: { id: string; reason: string }) => {
      const r = await apiFetch<{ ok: true }>(
        `/api/discovery/candidates/${opts.id}/dismiss`,
        { method: "POST", body: JSON.stringify({ reason: opts.reason }) },
      );
      if (!r.ok) throw new Error(r.error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discovery", "candidates"] }),
  });
}
