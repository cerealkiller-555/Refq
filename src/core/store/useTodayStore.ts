// ============================================================
// رِفق — Today Store (الطاقة، الأولويات، اقتراح "ماذا أفعل الآن؟")
// كل عمليات البيانات عبر Repositories — لا Dexie هنا.
// الاقتراح يراعي فترة اليوم بين الصلوات (Prayer Anchors) إن وُجدت.
// ============================================================

import { create } from 'zustand';
import {
  energyCheckinRepository,
  learningPathRepository,
  pathItemRepository,
  prayerAnchorRepository,
  taskRepository
} from '../db/repositories';
import type { TaskRecord, EnergyLevel, PrayerAnchor } from '../types';
import {
  completeTask as completeTaskLifecycle,
  deleteTask as deleteTaskLifecycle,
  updateTask as updateTaskLifecycle,
  onTaskLifecycleChange
} from '../services/taskLifecycle';
import { onLearningChange } from '../services/learningEvents';
import { useActiveTaskStore } from './useActiveTaskStore';
import { getTopPriorities } from '../engines/priorityEngine';
import { suggestTask, type SuggestionResult, type Suggestable } from '../engines/suggestionEngine';
import { nextSteps } from '../engines/learningEngine';
import { getCurrentPeriod, PRAYER_LABELS, type CurrentPeriod } from '../engines/dayPeriods';
import { localDateKey } from '../../utils';
import { fetchPrayerAnchors } from '../services/prayerTimesService';
import { getCoordinates } from '../services/geo';

interface TodayState {
  tasks: TaskRecord[];
  todayEnergy: EnergyLevel | null;
  lightDay: boolean;
  topPriorities: TaskRecord[];
  suggestion: SuggestionResult | null;
  anchors: PrayerAnchor[];
  currentPeriod: CurrentPeriod | null;
  loaded: boolean;
  loadToday: () => Promise<void>;
  checkIn: (level: EnergyLevel, note?: string, wantsLightDay?: boolean) => Promise<void>;
  askSuggestion: (availableMinutes: number) => Promise<void>;
  addQuickTask: (title: string, minutes?: number) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTask: (id: string, changes: Partial<TaskRecord>) => Promise<void>;
  clearSuggestion: () => void;
  /** إعادة قراءة المهام والأولويات — يدويًا أو عند تغيّر دورة المهمة من أي شاشة */
  refresh: () => Promise<void>;
  syncPrayerAnchors: () => Promise<void>;
}

export const useTodayStore = create<TodayState>((set, get) => {
  /** تحديث قائمة المهام + الأولويات (مع الطاقة الحالية) */
  const refresh = async () => {
    const energy = (await energyCheckinRepository.getToday())?.level;
    const tasks = await taskRepository.getOpenTasks();
    set({
      tasks,
      todayEnergy: energy ?? get().todayEnergy,
      topPriorities: getTopPriorities(tasks, 3, undefined, energy ?? undefined)
    });
  };

  /** جلب مراسي اليوم مع fallback آمن — لا يُفشِل Today أبدًا */
  const syncPrayerAnchorsInternal = async () => {
    const dateKey = localDateKey();
    let anchors: PrayerAnchor[] = [];

    try {
      const coords = await getCoordinates();
      if (coords) {
        const fetched = await fetchPrayerAnchors({ dateKey, lat: coords.lat, lon: coords.lon });
        anchors = (await prayerAnchorRepository.replaceForDate(dateKey, fetched)) as PrayerAnchor[];
      }
    } catch {
      anchors = [];
    }

    // fallback: لا إحداثيات/جلب فاشل ← آخر مواقيت محفوظة اليوم، أو لا شيء.
    // قاعدة مغلقة أثناء الإقلاع/التنظيف لا تُفشِل أبدًا.
    if (anchors.length === 0) {
      try {
        anchors = await prayerAnchorRepository.getForDate(dateKey);
      } catch {
        anchors = [];
      }
    }

    set({
      anchors,
      currentPeriod: getCurrentPeriod(anchors, new Date().toISOString())
    });
  };

  return {
    tasks: [],
    todayEnergy: null,
    lightDay: false,
    topPriorities: [],
    suggestion: null,
    anchors: [],
    currentPeriod: null,
    loaded: false,

    loadToday: async () => {
      let tasks: TaskRecord[] = [];
      let energy = null;
      try {
        const [loadedTasks, loadedEnergy] = await Promise.all([
          taskRepository.getOpenTasks(),
          energyCheckinRepository.getToday()
        ]);
        tasks = loadedTasks;
        energy = loadedEnergy;
      } catch {
        // فشل قراءة (قاعدة مغلقة/خطأ) — نكمل بحالة فارغة بلا انهيار أبدًا
      }
      set({
        tasks,
        todayEnergy: energy?.level ?? null,
        lightDay: energy?.wantsLightDay ?? false,
        topPriorities: getTopPriorities(tasks, 3, undefined, energy?.level),
        loaded: true
      });
      // جلب المواقيت (لا يعلق التحميل — نافذ/fallback في الخلفية)
      await syncPrayerAnchorsInternal();
    },

    syncPrayerAnchors: () => syncPrayerAnchorsInternal(),

    checkIn: async (level, note, wantsLightDay = false) => {
      const saved = await energyCheckinRepository.upsertToday(level, note, wantsLightDay);
      set({ todayEnergy: saved.level, lightDay: saved.wantsLightDay });
      await refresh();
    },

    askSuggestion: async (availableMinutes) => {
      const tasks = await taskRepository.getOpenTasks();
      const energy = (await energyCheckinRepository.getToday())?.level;
      const current = get().currentPeriod;

      // خطوات التعلّم القادمة تُرشَّح للاقتراح كذلك (المسارات النشطة فقط)
      // فشل القراءة (قاعدة مغلقة/لا مسارات) لا يمنع اقتراح المهام أبدًا.
      let learningSuggestables: Suggestable[] = [];
      try {
        const paths = (await learningPathRepository.getAll()).filter((p) => p.status === 'active');
        const itemsByPath: Record<string, Awaited<ReturnType<typeof pathItemRepository.getByPath>>> = {};
        await Promise.all(
          paths.map(async (p) => {
            itemsByPath[p.id] = await pathItemRepository.getByPath(p.id);
          })
        );
        learningSuggestables = nextSteps(paths, itemsByPath).map((s) => s.suggestable);
      } catch {
        learningSuggestables = [];
      }

      const suggestion = suggestTask([...tasks, ...learningSuggestables], {
        availableMinutes,
        energy,
        period: current
          ? {
              remainingMinutes: current.period.remainingMinutes,
              nextAnchorLabel: current.nextAnchor
                ? PRAYER_LABELS[current.nextAnchor.prayer]
                : undefined
            }
          : undefined
      });
      set({ tasks, suggestion });
    },

    addQuickTask: async (title, minutes = 15) => {
      await taskRepository.create({
        title,
        importance: 'low',
        urgency: 'low',
        estimatedDuration: minutes,
        energyRequired: 'low',
        status: 'todo'
      } as TaskRecord);
      await refresh();
    },

    completeTask: async (id) => {
      // مسار دورة الحياة الموحّد — يحرّر أحداثها المرنة في التقويم أيضًا (لا أشباح)
      await completeTaskLifecycle(id);
      set({ suggestion: null });
      await refresh();
      await useActiveTaskStore.getState().load(); // الشريط قد يعرض هذه المهمة
    },

    deleteTask: async (id) => {
      await deleteTaskLifecycle(id);
      set({ suggestion: null });
      await refresh();
      await useActiveTaskStore.getState().load();
    },

    updateTask: async (id, changes) => {
      await updateTaskLifecycle(id, changes);
      await refresh();
      await useActiveTaskStore.getState().load(); // عنوان المهمة الجارية قد تغيّر
    },

    refresh,

    clearSuggestion: () => set({ suggestion: null })
  };
});

// أي تغيّر في دورة حياة المهمة من شاشة أخرى ← تحديث قوائم اليوم وأولوياتها (قراءات فقط)
onTaskLifecycleChange(() => {
  void useTodayStore.getState().refresh().catch(() => {
    // قاعدة مغلقة أثناء الإيقاف — التحميل القادم يصحح
  });
});

// أي تغيّر في خطوات التعلّم من شاشة أخرى (إضافة/تعديل/حذف/إنجاز) ← إبطال لقطة الاقتراح،
// فلا يُقترح «ماذا أفعل الآن؟» بخطوة حُذفت أو أُنجزت أو تغيّر عنوانها.
// إبطال فقط (قراءة عند الطلب) — لا إعادة حساب هنا، ولا كتابة ⇒ لا حلقة.
onLearningChange(() => {
  useTodayStore.getState().clearSuggestion();
});