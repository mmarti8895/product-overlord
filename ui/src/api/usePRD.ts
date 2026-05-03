/**
 * React Query hooks for the PRD API (task 4.2)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client.js";
import { usePRDStore } from "../stores/prdStore.js";
import type { PRDDraft, PRDDiff, DocumentType } from "../types/prd.js";

export function usePRDDrafts(ticketKey: string | null) {
  const setDrafts = usePRDStore((s) => s.setDrafts);
  return useQuery({
    queryKey: ["prd", "drafts", ticketKey],
    queryFn: async () => {
      if (!ticketKey) return [] as PRDDraft[];
      const r = await apiFetch<{ ok: true; data: PRDDraft[] }>(`/api/prd/${ticketKey}/drafts`);
      if (!r.ok) throw new Error(r.error.message);
      setDrafts(ticketKey, r.data.data);
      return r.data.data;
    },
    enabled: Boolean(ticketKey),
    staleTime: 30_000,
  });
}

export function usePRDDraft(ticketKey: string | null, id: string | null) {
  const setActiveDraft = usePRDStore((s) => s.setActiveDraft);
  return useQuery({
    queryKey: ["prd", "draft", ticketKey, id],
    queryFn: async () => {
      if (!ticketKey || !id) return null;
      const r = await apiFetch<{ ok: true; data: PRDDraft }>(`/api/prd/${ticketKey}/drafts/${id}`);
      if (!r.ok) throw new Error(r.error.message);
      setActiveDraft(r.data.data);
      return r.data.data;
    },
    enabled: Boolean(ticketKey && id),
    staleTime: 30_000,
  });
}

export function usePRDDiff(ticketKey: string | null, id: string | null) {
  return useQuery({
    queryKey: ["prd", "diff", ticketKey, id],
    queryFn: async () => {
      if (!ticketKey || !id) return null;
      const r = await apiFetch<{ ok: true; data: PRDDiff }>(`/api/prd/${ticketKey}/drafts/${id}/diff`);
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    enabled: Boolean(ticketKey && id),
    staleTime: 60_000,
  });
}

export function useGenerateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts: { ticket_key: string; doc_type: DocumentType }) => {
      const r = await apiFetch<{ ok: true; data: PRDDraft }>(
        `/api/prd/${opts.ticket_key}/drafts`,
        { method: "POST", body: JSON.stringify({ doc_type: opts.doc_type }) },
      );
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["prd", "drafts", vars.ticket_key] });
    },
  });
}

export function useApproveDraft(ticketKey: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await apiFetch<{ ok: true; data: PRDDraft }>(
        `/api/prd/${ticketKey}/drafts/${id}/approve`,
        { method: "POST" },
      );
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prd", "drafts", ticketKey] });
      qc.invalidateQueries({ queryKey: ["prd", "draft", ticketKey, id] });
    },
  });
}

export function usePublishDraft(ticketKey: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await apiFetch<{ ok: true; data: PRDDraft }>(
        `/api/prd/${ticketKey}/drafts/${id}/publish`,
        { method: "POST" },
      );
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prd", "drafts", ticketKey] });
      qc.invalidateQueries({ queryKey: ["prd", "draft", ticketKey, id] });
    },
  });
}
