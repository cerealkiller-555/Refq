// ============================================================
// رِفق — Planning Store (المهام — إدارة كاملة)
// التقويم والأحداث تُبنى في P2 فوق نفس الـstore.
// ============================================================

import { create } from 'zustand';
import {
  taskRepository,
  calendarRepository
} from '../db/repositories';
import type { TaskRecord, CalendarEvent } from '../types';

interface PlanningState {
  tasks: TaskRecord[];
  events: CalendarEvent[];
  load: () => Promise<void>;
  addTask: (task: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  markTaskDone: (id: string) => Promise<void>;
  reopenTask: (id: string) => Promise<void>;
  updateTask: (id: string, changes: Partial<TaskRecord>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  replan: () => Promise<void>;
}

export const usePlanningStore = create<PlanningState>((set) => ({
  tasks: [],
  events: [],

  load: async () => {
    const [tasks, events] = await Promise.all([
      taskRepository.getAll(),
      calendarRepository.getAll()
    ]);
    set({ tasks, events });
  },

  addTask: async (task) => {
    await taskRepository.create(task as TaskRecord);
    const tasks = await taskRepository.getAll();
    set({ tasks });
  },

  addEvent: async (event) => {
    await calendarRepository.create(event as CalendarEvent);
    const events = await calendarRepository.getAll();
    set({ events });
  },

  markTaskDone: async (id) => {
    await taskRepository.markDone(id);
    const tasks = await taskRepository.getAll();
    set({ tasks });
  },

  reopenTask: async (id) => {
    await taskRepository.update(id, { status: 'todo' });
    const tasks = await taskRepository.getAll();
    set({ tasks });
  },

  updateTask: async (id, changes) => {
    await taskRepository.update(id, changes);
    const tasks = await taskRepository.getAll();
    set({ tasks });
  },

  deleteTask: async (id) => {
    await taskRepository.delete(id);
    const tasks = await taskRepository.getAll();
    set({ tasks });
  },

  replan: async () => {
    // إعادة توزيع بسيطة: تُنفّذ بواسطة RecoveryEngine في P2 بالكامل
    // هذا skeleton يجلب المهام المفتوحة
    const tasks = await taskRepository.getOpenTasks();
    set({ tasks });
  }
}));