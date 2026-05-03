/**
 * prdStore — Zustand store (task 4.1)
 */

import { create } from "zustand";
import type { PRDDraft } from "../types/prd.js";

interface PRDState {
  draftsByTicket: Map<string, PRDDraft[]>;
  activeDraft:    PRDDraft | null;
  setDrafts:      (ticketKey: string, drafts: PRDDraft[]) => void;
  setActiveDraft: (draft: PRDDraft | null) => void;
  editSection:    (heading: string, content: string) => void;
}

export const usePRDStore = create<PRDState>((set) => ({
  draftsByTicket: new Map(),
  activeDraft:    null,

  setDrafts: (ticketKey, drafts) =>
    set((s) => {
      const next = new Map(s.draftsByTicket);
      next.set(ticketKey, drafts);
      return { draftsByTicket: next };
    }),

  setActiveDraft: (draft) => set({ activeDraft: draft }),

  editSection: (heading, content) =>
    set((s) => {
      if (!s.activeDraft) return s;
      return {
        activeDraft: {
          ...s.activeDraft,
          content: {
            sections: s.activeDraft.content.sections.map((sec) =>
              sec.heading === heading ? { ...sec, content } : sec,
            ),
          },
        },
      };
    }),
}));
