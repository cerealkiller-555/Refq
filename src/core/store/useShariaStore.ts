// ============================================================
// رِفق — ShariaText Store (النصوص الشرعية)
// ============================================================

import { create } from 'zustand';
import { shariaRepository } from '../db/repositories';
import type { ShariaText, ShariaTextKind } from '../types';

interface ShariaState {
  texts: ShariaText[];
  load: () => Promise<void>;
  addText: (
    kind: ShariaTextKind,
    text: string,
    source: string,
    opts?: { linkedNoteId?: string; pathId?: string }
  ) => Promise<void>;
  deleteText: (id: string) => Promise<void>;
  getByKind: (kind: ShariaTextKind) => ShariaText[];
}

export const useShariaStore = create<ShariaState>((set, get) => ({
  texts: [],

  load: async () => {
    const texts = await shariaRepository.getAll();
    set({ texts });
  },

  addText: async (kind, text, source, opts) => {
    const entry = await shariaRepository.addText(kind, text, source, opts);
    set({ texts: [...get().texts, entry] });
  },

  deleteText: async (id) => {
    await shariaRepository.delete(id);
    set({ texts: get().texts.filter((t) => t.id !== id) });
  },

  getByKind: (kind) => {
    return get().texts.filter((t) => t.kind === kind);
  }
}));
