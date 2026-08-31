// ============================================================
// رِفق — Today Store (الطاقة، الاقتراح، الأولويات)
// ============================================================

import { create } from 'zustand';
import { energyCheckinRepository } from '../db/repositories';
import { taskRepository } from '../db/repositories';
import type { TaskRecord, EnergyLevel } from '../types';
import { getTopPriorities } from '../engines/priorityEngine';
import { suggestTask, type SuggestionResult } from '../engines/suggestionEngine';

interface TodayState {
  tasks: TaskRecord[];
  todayEnergy: EnergyLevel | null;
  lightDay: boolean;
  topPriorities: TaskRecord[];
  suggestion: SuggestionResult | null;
  loadToday: () => Promise<void>;
  checkIn: (level: EnergyLevel, note?: string, wantsLightDay?: boolean) => Promise<void>;
  askSuggestion: (availableMinutes: number) => Promise<void>;
  addQuickTask: (title: string, minutes?: number) => Promise<void>;
}

export const useTodayStore = create<TodayState>((set) => ({
  tasks: [],
  todayEnergy: null,
  lightDay: false,
  topPriorities: [],
  suggestion: null,

  loadToday: async () => {
    const [tasks, energy] = await Promise.all([
      taskRepository.getOpenTasks(),
      energyCheckinRepository.getToday()
    ]);
    set({
      tasks,
      todayEnergy: energy?.level ?? null,
      lightDay: energy?.wantsLightDay ?? false,
      topPriorities: getTopPriorities(tasks, 3)
    });
  },

  checkIn: async (level, note, wantsLightDay = false) => {
    const saved = await energyCheckinRepository.upsertToday(level, note, wantsLightDay);
    set({ todayEnergy: saved.level, lightDay: saved.wantsLightDay });
  },

  askSuggestion: async (availableMinutes) => {
    // يُحدَّث من loadToday في الظروف العادية، لكن نضمن حداثة هنا
    const tasks = await taskRepository.getOpenTasks();
    const energy = (await energyCheckinRepository.getToday())?.level;
    const suggestion = suggestTask(tasks, { availableMinutes, energy });
    set({ tasks, suggestion });
  },

  addQuickTask: async (title, minutes = 15) => {
    await taskRepository.create({
      title,
      importance: 'low',
      urgency: 'low',
      estimatedDuration: minutes,
      status: 'todo'
    } as TaskRecord);
    const tasks = await taskRepository.getOpenTasks();
    set({ tasks, topPriorities: getTopPriorities(tasks, 3) });
  }
}));