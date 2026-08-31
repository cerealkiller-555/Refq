// ============================================================
// رِفق — Learning Store (المسارات، العناصر، الجلسات)
// ============================================================

import { create } from 'zustand';
import {
  learningPathRepository,
  pathItemRepository,
  sessionRepository
} from '../db/repositories';
import type { LearningPath, PathItem, Session } from '../types';

interface LearningState {
  paths: LearningPath[];
  itemsByPath: Record<string, PathItem[]>;
  sessions: Session[];
  load: () => Promise<void>;
  addPath: (path: Omit<LearningPath, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  addItem: (item: Omit<PathItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  getItemsForPath: (pathId: string) => Promise<void>;
  addSession: (session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export const useLearningStore = create<LearningState>((set, get) => ({
  paths: [],
  itemsByPath: {},
  sessions: [],

  load: async () => {
    const paths = await learningPathRepository.getAll();
    set({ paths });
  },

  addPath: async (path) => {
    await learningPathRepository.create(path as LearningPath);
    const paths = await learningPathRepository.getAll();
    set({ paths });
  },

  addItem: async (item) => {
    await pathItemRepository.create(item as PathItem);
    if (item.pathId) await get().getItemsForPath(item.pathId);
  },

  getItemsForPath: async (pathId) => {
    const items = await pathItemRepository.getByPath(pathId);
    set((state) => ({ itemsByPath: { ...state.itemsByPath, [pathId]: items } }));
  },

  addSession: async (session) => {
    await sessionRepository.create(session as Session);
    const all = await sessionRepository.getAll();
    set({ sessions: all });
  }
}));