// ============================================================
// رِفق — Learning Store (المسارات، العناصر، الجلسات)
// عمليات CRUD كاملة + تحميل الجلسات والعناصر والخطوة التالية.
// كل عمليات البيانات عبر Repositories — لا Dexie هنا.
// ============================================================

import { create } from 'zustand';
import {
  learningPathRepository,
  pathItemRepository,
  sessionRepository
} from '../db/repositories';
import { nextSteps, type NextStep } from '../engines/learningEngine';
import type { LearningPath, PathItem, Session } from '../types';

interface LearningState {
  paths: LearningPath[];
  itemsByPath: Record<string, PathItem[]>;
  sessions: Session[];
  load: () => Promise<void>;
  addPath: (path: Omit<LearningPath, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  setPathStatus: (id: string, status: LearningPath['status']) => Promise<void>;
  deletePath: (id: string) => Promise<void>;
  addItem: (item: Omit<PathItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateItem: (id: string, changes: Partial<PathItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  getItemsForPath: (pathId: string) => Promise<void>;
  addSession: (session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  getSessionsForItem: (itemId: string) => Promise<Session[]>;
  /** الخطوة القادمة لكل مسار نشط — يعيد حساباتها الانتقالية كلما تغيّر العنصر */
  getNextSteps: () => Promise<NextStep[]>;
}

export const useLearningStore = create<LearningState>((set, get) => ({
  paths: [],
  itemsByPath: {},
  sessions: [],

  load: async () => {
    const [paths, sessions] = await Promise.all([
      learningPathRepository.getAll(),
      sessionRepository.getAll()
    ]);
    // تحميل عناصر المسارات النشطة فقط (للاقتراح والخطوة القادمة)
    const activePaths = paths.filter((p) => p.status === 'active');
    const itemsByPath: Record<string, PathItem[]> = {};
    await Promise.all(
      activePaths.map(async (p) => {
        itemsByPath[p.id] = await pathItemRepository.getByPath(p.id);
      })
    );
    set({ paths, sessions, itemsByPath });
  },

  addPath: async (path) => {
    await learningPathRepository.create(path as LearningPath);
    await get().load();
  },

  setPathStatus: async (id, status) => {
    await learningPathRepository.update(id, { status });
    await get().load();
  },

  deletePath: async (id) => {
    await learningPathRepository.delete(id);
    // حذف عناصرها أيضًا (بلا إزعاج للمستخدم — تكامل معرّف)
    const items = await pathItemRepository.getByPath(id);
    for (const item of items) await pathItemRepository.delete(item.id);
    await get().load();
  },

  addItem: async (item) => {
    await pathItemRepository.create(item as PathItem);
    if (item.pathId) await get().getItemsForPath(item.pathId);
  },

  updateItem: async (id, changes) => {
    await pathItemRepository.update(id, changes);
    const all = await pathItemRepository.getAll();
    // إعادة تقييم العناصر للمسارات النشطة بعد تغيير الحالة
    const itemsByPath: Record<string, PathItem[]> = {};
    for (const path of get().paths) {
      if (path.status === 'active') {
        itemsByPath[path.id] = all.filter((i) => i.pathId === path.id).sort((a, b) => a.order - b.order);
      }
    }
    set({ itemsByPath });
  },

  deleteItem: async (id) => {
    const item = await pathItemRepository.get(id);
    await pathItemRepository.delete(id);
    if (item?.pathId) await get().getItemsForPath(item.pathId);
  },

  getItemsForPath: async (pathId) => {
    const items = await pathItemRepository.getByPath(pathId);
    set((state) => ({ itemsByPath: { ...state.itemsByPath, [pathId]: items } }));
  },

  addSession: async (session) => {
    await sessionRepository.create(session as Session);
    const all = await sessionRepository.getAll();
    set({ sessions: all });
  },

  getSessionsForItem: async (itemId) => {
    return sessionRepository.getByPathItem(itemId);
  },

  getNextSteps: async () => {
    return nextSteps(get().paths, get().itemsByPath);
  }
}));