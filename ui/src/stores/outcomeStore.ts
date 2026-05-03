/**
 * outcomeStore — Zustand store for outcome state (task 6.1)
 */

import { create } from "zustand";

interface OutcomeState {
  selectedOKRId:  string | null;
  selectedEpicKey: string | null;
  selectOKR:      (id: string | null) => void;
  selectEpic:     (key: string | null) => void;
}

export const useOutcomeStore = create<OutcomeState>((set) => ({
  selectedOKRId:   null,
  selectedEpicKey: null,
  selectOKR:       (id) => set({ selectedOKRId: id }),
  selectEpic:      (key) => set({ selectedEpicKey: key }),
}));
