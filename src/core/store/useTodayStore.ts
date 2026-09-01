// ============================================================
// رِفق — Today Store (الطاقة، الأولويات، اقتراح "ماذا أفعل الآن؟")
// كل عمليات البيانات عبر Repositories — لا Dexie هنا.
// الاقتراح يراعي فترة اليوم بين الصلوات (Prayer Anchors) إن وُجدت.
// ============================================================

import { create } from 'zustand';
import { energyCheckinRepository, prayerAnchorRepository, taskRepository } from '../db/repositories';
import type { TaskRecord, EnergyLevel } from '../types';
import { getTopPriorities } from '../engines/priorityEngine';
import { suggestTask, type SuggestionResult } from '../engines/suggestionEngine';
import { getCurrentPeriod, PRAYER_LABELS } from '../engines/dayPeriods';
import { localDateKey } from '../../utils';

interface TodayState {
  tasks: TaskRecord[];
  todayEnergy: EnergyLevel | null;
  lightDay: boolean;
  topPriorities: TaskRecord[];
  suggestion: SuggestionResult | null;
  loaded: boolean;
  loadToday: () => Promise<void>;
  checkIn: (level: EnergyLevel, note?: string, wantsLightDay?: boolean) => Promise<void>;
  askSuggestion: (availableMinutes: number) => Promise<void>;
  addQuickTask: (title: string, minutes?: number) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTask: (id: string, changes: Partial<TaskRecord>) => Promise<void>;
  clearSuggestion: () => void;
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

  return {
    tasks: [],
    todayEnergy: null,
    lightDay: false,
    topPriorities: [],
    suggestion: null,
    loaded: false,

    loadToday: async () => {
      const [tasks, energy] = await Promise.all([
        taskRepository.getOpenTasks(),
        energyCheckinRepository.getToday()
      ]);
      set({
        tasks,
        todayEnergy: energy?.level ?? null,
        lightDay: energy?.wantsLightDay ?? false,
        topPriorities: getTopPriorities(tasks, 3, undefined, energy?.level),
        loaded: true
      });
    },

    checkIn: async (level, note, wantsLightDay = false) => {
      const saved = await energyCheckinRepository.upsertToday(level, note, wantsLightDay);
      set({ todayEnergy: saved.level, lightDay: saved.wantsLightDay });
      await refresh();
    },

    askSuggestion: async (availableMinutes) => {
      const tasks = await taskRepository.getOpenTasks();
      const energy = (await energyCheckinRepository.getToday())?.level;
      const anchors = await prayerAnchorRepository.getForDate(localDateKey());
      const current = getCurrentPeriod(anchors, new Date().toISOString());
      const suggestion = suggestTask(tasks, {
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
      await taskRepository.complete(id);
      set({ suggestion: null });
      await refresh();
    },

    deleteTask: async (id) => {
      await taskRepository.delete(id);
      set({ suggestion: null });
      await refresh();
    },

    updateTask: async (id, changes) => {
      await taskRepository.update(id, changes);
      await refresh();
    },

    clearSuggestion: () => set({ suggestion: null })
  };
});