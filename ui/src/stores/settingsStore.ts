import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  serverUrl: string;
  port: number;
  authToken: string;
  shadowMode: boolean;
  degradedLLM: boolean;
  degradedRepo: boolean;
  setServerUrl: (url: string) => void;
  setPort: (port: number) => void;
  setAuthToken: (token: string) => void;
  setShadowMode: (v: boolean) => void;
  setDegradedLLM: (v: boolean) => void;
  setDegradedRepo: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      serverUrl: "http://localhost:3000",
      port: 3000,
      authToken: "",
      shadowMode: false,
      degradedLLM: false,
      degradedRepo: false,
      setServerUrl: (serverUrl) => set({ serverUrl }),
      setPort: (port) => set({ port, serverUrl: `http://localhost:${port}` }),
      setAuthToken: (authToken) => set({ authToken }),
      setShadowMode: (shadowMode) => set({ shadowMode }),
      setDegradedLLM: (degradedLLM) => set({ degradedLLM }),
      setDegradedRepo: (degradedRepo) => set({ degradedRepo }),
    }),
    { name: "overlord-settings" }
  )
);
