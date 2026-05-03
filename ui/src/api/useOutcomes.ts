/**
 * React Query hooks for the outcomes API (task 6.2)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client.js";
import type { OKR, OutcomeSnapshot } from "../types/outcomes.js";

export function useOKRs() {
  return useQuery({
    queryKey: ["outcomes", "okrs"],
    queryFn: async () => {
      const r = await apiFetch<{ ok: true; data: OKR[] }>("/api/outcomes/okrs");
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    staleTime: 60_000,
  });
}

export function useOKR(id: string | null) {
  return useQuery({
    queryKey: ["outcomes", "okr", id],
    queryFn: async () => {
      if (!id) return null;
      const r = await apiFetch<{ ok: true; data: OKR }>(`/api/outcomes/okrs/${id}`);
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useOutcomeSnapshot(epicKey: string | null) {
  return useQuery({
    queryKey: ["outcomes", "snapshot", epicKey],
    queryFn: async () => {
      if (!epicKey) return null;
      const r = await apiFetch<{ ok: true; data: OutcomeSnapshot }>(`/api/outcomes/${epicKey}/snapshot`);
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    enabled: Boolean(epicKey),
    staleTime: 30_000,
  });
}

export function useCreateOKR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<OKR>) => {
      const r = await apiFetch<{ ok: true; data: OKR }>("/api/outcomes/okrs", {
        method: "POST", body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outcomes", "okrs"] }),
  });
}

export function useLinkEpicToOKR(okrId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (epicKey: string) => {
      const r = await apiFetch<{ ok: true }>(`/api/outcomes/okrs/${okrId}/link-epic`, {
        method: "POST", body: JSON.stringify({ epic_key: epicKey }),
      });
      if (!r.ok) throw new Error(r.error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outcomes", "okrs"] }),
  });
}

export function usePatchSnapshotNotes(epicKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notes: string) => {
      const r = await apiFetch<{ ok: true; data: OutcomeSnapshot }>(
        `/api/outcomes/${epicKey}/snapshot/notes`,
        { method: "PATCH", body: JSON.stringify({ notes }) },
      );
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outcomes", "snapshot", epicKey] }),
  });
}
