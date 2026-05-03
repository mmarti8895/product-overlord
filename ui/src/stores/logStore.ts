import { create } from "zustand";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: unknown;
}

const MAX_ENTRIES = 2000;

interface LogState {
  entries: LogEntry[];
  append: (entry: Omit<LogEntry, "id">) => void;
  clear: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  append: (entry) =>
    set(s => {
      const newEntries = [
        ...s.entries,
        { ...entry, id: crypto.randomUUID() },
      ];
      return { entries: newEntries.length > MAX_ENTRIES ? newEntries.slice(-MAX_ENTRIES) : newEntries };
    }),
  clear: () => set({ entries: [] }),
}));
