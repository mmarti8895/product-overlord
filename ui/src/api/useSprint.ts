/**
 * useSprint — React Query hook for fetching a board's SprintSnapshot (task 4.3)
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client.js";
import type { SprintSnapshot } from "../types/sprint.js";

export function useSprint(boardId: string | null) {
  return useQuery({
    queryKey: ["sprint", "snapshot", boardId],
    queryFn: async () => {
      if (!boardId) return null;
      const result = await apiFetch<{ ok: true; data: SprintSnapshot | null }>(`/api/sprint/${boardId}/snapshot`);
      if (!result.ok) throw new Error(result.error.message);
      return result.data.data;
    },
    enabled: Boolean(boardId),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
