import { create } from "zustand";

export interface KBSource {
  id: string;
  name: string;
  type: "file" | "url";
  projectKey: string;
  size: number;
  indexedAt: string;
}

interface KBState {
  sources: KBSource[];
  usedBytes: number;
  maxBytes: number;
  setSources: (sources: KBSource[]) => void;
  setStorage: (used: number, max: number) => void;
  removeSource: (id: string) => void;
}

export const useKBStore = create<KBState>((set) => ({
  sources: [],
  usedBytes: 0,
  maxBytes: 50 * 1024 * 1024 * 1024, // 50 GB default
  setSources: (sources) => set({ sources }),
  setStorage: (usedBytes, maxBytes) => set({ usedBytes, maxBytes }),
  removeSource: (id) => set(s => ({ sources: s.sources.filter(src => src.id !== id) })),
}));
