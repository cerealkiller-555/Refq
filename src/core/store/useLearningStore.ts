// ============================================================
// رِفق — Learning Store (المسارات، العناصر، الجلسات)
// عمليات CRUD كاملة + تحميل الجلسات والعناصر والخطوة التالية.
// كل عمليات البيانات عبر Repositories — لا Dexie هنا.
// الكاتب الوحيد لخطوات المسارات: كل عملية كتابة هنا تُحدّث الـDB والحالة المحمّلة
// ثم تُنشَر على قناة التعلّم (learningEvents) مرة واحدة لكل عملية — والمستهلكون يقرأون فقط.
// ============================================================

import { create } from 'zustand';
import {
  learningPathRepository,
  pathItemRepository,
  sessionRepository
} from '../db/repositories';
import { nextSteps, type NextStep } from '../engines/learningEngine';
import { notifyLearningChange } from '../services/learningEvents';
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
  /**
   * الكتابة الوحيدة لحالة الخطوة في كل التطبيق — تحدّث الـDB والحالة المحمّلة
   * معًا (تقدّم فوري في «خطتي») ثم تنشر القناة تلقائيًا (type: 'status') لتحديث
   * بقية المستهلكين. لا إشعار إن لم يوجد الصف (لا كتابة = لا إشعار).
   * notify: false للإنجاز فقط — completeItem ينشر 'completed' بنفسه فلا إشعاران لعملية واحدة.
   */
  setItemStatus: (
    itemId: string,
    status: PathItem['status'],
    pathId?: string,
    opts?: { notify?: boolean }
  ) => Promise<string | undefined>;
  /**
   * إنجاز خطوة من أي شاشة — نقطة تسجيل الجلسة الموحّدة:
   * setItemStatus (الكاتب الوحيد للحالة) + جلسة واحدة إن كانت هناك جلسة مفتوحة
   * حقيقية (وصفها من المؤقت الجاري) + إشعار القناة. بلا جلسة مفتوحة لا نخترع مدة.
   */
  completeItem: (
    itemId: string,
    pathId?: string,
    sitting?: { durationMinutes: number }
  ) => Promise<void>;
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
    // عناصر كل المسارات — لا النشطة فقط: المسار الموقوف/المكتمل يعرض خطواته وتقدّمه
    // (nextSteps نفسها تستبعد غير النشط، فاقتراح «اليوم» لا يتأثر)
    const itemsByPath: Record<string, PathItem[]> = {};
    await Promise.all(
      paths.map(async (p) => {
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
    // المسار وخطواته اختفوا معًا — إشعار واحد بالمسار يكفي (المستهلكون يقرأون من الـDB)
    notifyLearningChange({ type: 'path-removed', pathId: id });
  },

  addItem: async (item) => {
    // السجل المُنشأ هو مصدر المعرّف (المستودع يولّده) — لا نعتمد على معرّف الواجهة
    const created = await pathItemRepository.create(item as PathItem);
    if (created.pathId) await get().getItemsForPath(created.pathId);
    notifyLearningChange({ type: 'added', itemId: created.id, pathId: created.pathId });
  },

  updateItem: async (id, changes) => {
    const updated = await pathItemRepository.update(id, changes);
    const all = await pathItemRepository.getAll();
    // إعادة تقييم عناصر كل المسارات (نفس قاعدة load) بعد تغيير حالة خطوة
    const itemsByPath: Record<string, PathItem[]> = {};
    for (const path of get().paths) {
      itemsByPath[path.id] = all.filter((i) => i.pathId === path.id).sort((a, b) => a.order - b.order);
    }
    set({ itemsByPath });
    // الإشعار بعد الكتابة والحالة — يحدّث بقية المستهلكين (الشريط/«اليوم») بقراءة فقط.
    // لا صف = لا كتابة = لا إشعار (معرّف قديم/محذوف).
    if (updated) notifyLearningChange({ type: 'status', itemId: id, pathId: updated.pathId });
  },

  deleteItem: async (id) => {
    const item = await pathItemRepository.get(id);
    await pathItemRepository.delete(id);
    // لا صف = لا كتابة = لا إشعار، ولا إعادة قراءة بلا سبب
    if (!item) return;
    await get().getItemsForPath(item.pathId);
    notifyLearningChange({ type: 'removed', itemId: id, pathId: item.pathId });
  },

  setItemStatus: async (itemId, status, pathId, opts) => {
    const updated = await pathItemRepository.update(itemId, { status });
    // معرّف قديم/محذوف = لا كتابة ولا حالة ولا إشعار (لا نبثّ تغييرًا لم يحدث)
    if (!updated) return undefined;
    const targetPathId = pathId ?? updated.pathId;
    // تحديث فوري للحالة المحمّلة — لا إعادة تحميل كاملة لكل خطوة
    if (targetPathId) {
      set((state) => {
        const list = state.itemsByPath[targetPathId];
        // لم تُحمَّل بعد — لا نبني حالة ناقصة (التحميل القادم يصحح)
        if (!list) return state;
        return {
          itemsByPath: {
            ...state.itemsByPath,
            [targetPathId]: list.map((i) => (i.id === itemId ? { ...i, status } : i))
          }
        };
      });
    }
    // قناة التعلّم: إشعار واحد لكل تغيير حالة حقيقي
    // (completeItem يمرّر notify:false وينشر 'completed' بنفسه — لا إشعاران لعملية واحدة)
    if (opts?.notify !== false) {
      notifyLearningChange({ type: 'status', itemId, pathId: targetPathId });
    }
    return targetPathId;
  },

  completeItem: async (itemId, pathId, sitting) => {
    // الكتابة بلا إشعار 'status' — الإنجاز ينشر 'completed' مرة واحدة أدناه
    const targetPathId = await get().setItemStatus(itemId, 'done', pathId, { notify: false });
    // الإغلاق الوحيد للجلسة عند الإنجاز: الجلسة المفتوحة تُسجَّل هنا مرة واحدة
    if (sitting && sitting.durationMinutes > 0) {
      await get().addSession({
        pathItemId: itemId,
        date: new Date().toISOString(),
        durationMinutes: sitting.durationMinutes
      });
    }
    // إشعار واحد فقط لكل إنجاز (لا 'status' + 'completed')، والمسار من الكتابة الفعلية
    notifyLearningChange({ type: 'completed', itemId, pathId: targetPathId ?? pathId });
  },

  getItemsForPath: async (pathId) => {
    const items = await pathItemRepository.getByPath(pathId);
    set((state) => ({ itemsByPath: { ...state.itemsByPath, [pathId]: items } }));
  },

  addSession: async (session) => {
    // الجلسات ليست تغييرًا على خطوة — لا إشعار قناة (المستهلكون يقرأون الجلسات من الحالة)
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