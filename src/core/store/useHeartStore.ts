// ============================================================
// رِفق — Heart Store (التأملات، طاقة اليوم)
// ============================================================

import { create } from 'zustand';
import { reflectionRepository } from '../db/repositories';
import type { ReflectionEntry } from '../types';

interface HeartState {
  reflections: ReflectionEntry[];
  load: () => Promise<void>;
  addReflection: (
    kind: ReflectionEntry['kind'],
    answers: Record<string, string>,
    opts?: { linkedPathItemId?: string; skipped?: boolean }
  ) => Promise<void>;
  getTodayByKind: (kind: ReflectionEntry['kind']) => Promise<ReflectionEntry | undefined>;
}

export const useHeartStore = create<HeartState>((set) => ({
  reflections: [],

  load: async () => {
    const reflections = await reflectionRepository.getAll();
    set({ reflections });
  },

  addReflection: async (kind, answers, opts) => {
    const entry = await reflectionRepository.addEntry(kind, answers, { ...opts });
    const reflections = [...(useHeartStore.getState().reflections), entry];
    set({ reflections });
  },

  getTodayByKind: async (kind) => {
    const today = new Date().toISOString().slice(0, 10);
    const matches = await reflectionRepository.getByDate(today, kind);
    return matches[0];
  }
}));