/**
 * React Query hooks for the portfolio API (task 6.2)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client.js";
import type { Portfolio, PortfolioSnapshot, PortfolioDigest, CrossProjectEdge, CapacityRow } from "../types/portfolio.js";

export function usePortfolios() {
  return useQuery({
    queryKey: ["portfolio", "list"],
    queryFn: async () => {
      const r = await apiFetch<{ ok: true; data: Portfolio[] }>("/api/portfolio");
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    staleTime: 60_000,
  });
}

export function usePortfolioSnapshot(id: string | null) {
  return useQuery({
    queryKey: ["portfolio", "snapshot", id],
    queryFn: async () => {
      if (!id) return null;
      const r = await apiFetch<{ ok: true; data: PortfolioSnapshot }>(`/api/portfolio/${id}/snapshot`);
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function usePortfolioDependencies(id: string | null) {
  return useQuery({
    queryKey: ["portfolio", "dependencies", id],
    queryFn: async () => {
      if (!id) return [] as CrossProjectEdge[];
      const r = await apiFetch<{ ok: true; data: CrossProjectEdge[] }>(`/api/portfolio/${id}/dependencies`);
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function usePortfolioCapacity(id: string | null) {
  return useQuery({
    queryKey: ["portfolio", "capacity", id],
    queryFn: async () => {
      if (!id) return [] as CapacityRow[];
      const r = await apiFetch<{ ok: true; data: CapacityRow[] }>(`/api/portfolio/${id}/capacity`);
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function usePortfolioDigest(id: string | null) {
  return useQuery({
    queryKey: ["portfolio", "digest", id],
    queryFn: async () => {
      if (!id) return null;
      const r = await apiFetch<{ ok: true; data: PortfolioDigest }>(`/api/portfolio/${id}/digest`);
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useRefreshPortfolio(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await apiFetch<{ ok: true }>(`/api/portfolio/${id}/refresh`, { method: "POST" });
      if (!r.ok) throw new Error(r.error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio", "snapshot", id] });
      qc.invalidateQueries({ queryKey: ["portfolio", "capacity", id] });
      qc.invalidateQueries({ queryKey: ["portfolio", "dependencies", id] });
    },
  });
}

export function useGenerateDigest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await apiFetch<{ ok: true; data: PortfolioDigest }>(`/api/portfolio/${id}/digest/generate`, { method: "POST" });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio", "digest", id] }),
  });
}

export function useDeliverDigest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channel: "slack" | "confluence") => {
      const r = await apiFetch<{ ok: true }>(`/api/portfolio/${id}/digest/deliver`, {
        method: "POST", body: JSON.stringify({ channel }),
      });
      if (!r.ok) throw new Error(r.error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio", "digest", id] }),
  });
}

export function useCreatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; project_keys: string[] }) => {
      const r = await apiFetch<{ ok: true; data: Portfolio }>("/api/portfolio", {
        method: "POST", body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio", "list"] }),
  });
}
