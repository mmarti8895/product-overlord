/**
 * portfolioStore — Zustand store (task 6.1)
 */

import { create } from "zustand";

interface PortfolioState {
  selectedId:    string | null;
  activeTab:     "overview" | "deps" | "capacity" | "digest";
  selectPortfolio: (id: string | null) => void;
  setTab:        (tab: PortfolioState["activeTab"]) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  selectedId: null,
  activeTab:  "overview",
  selectPortfolio: (id) => set({ selectedId: id }),
  setTab:     (tab) => set({ activeTab: tab }),
}));
