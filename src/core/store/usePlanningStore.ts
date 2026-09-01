// ============================================================
// رِفق — Planning Store
// المهام + التقويم + إعادة التوزيع اللطيفة.
// ============================================================

import { create } from 'zustand';
import {
  taskRepository,
  calendarRepository
} from '../db/repositories';
import { recomputePlan } from '../engines/recoveryEngine';
import type { TaskRecord, CalendarEvent } from '../types';

interface ReplanResult {
  message: string;
  moved: Array<{ taskId: string; scheduledAt: string }>;
  untouched: Array<{ taskId: string; reason: string }>;
}

interface PlanningState {
  tasks: TaskRecord[];
  events: CalendarEvent[];
  lastReplan: ReplanResult | null;
  load: () => Promise<void>;
  addTask: (task: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEvent: (id: string, changes: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  scheduleTask: (taskId: string, date: string, time: string) => Promise<void>;
  markTaskDone: (id: string) => Promise<void>;
  reopenTask: (id: string) => Promise<void>;
  updateTask: (id: string, changes: Partial<TaskRecord>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  replan: () => Promise<ReplanResult>;
}

function localDateTimeISO(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
}

function plusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + Math.max(0, minutes) * 60000).toISOString();
}

async function refresh(set: (state: Partial<PlanningState>) => void): Promise<void> {
  const [tasks, events] = await Promise.all([
    taskRepository.getAll(),
    calendarRepository.getAll()
  ]);
  set({ tasks, events });
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  tasks: [],
  events: [],
  lastReplan: null,

  load: async () => {
    await refresh(set);
  },

  addTask: async (task) => {
    await taskRepository.create(task as TaskRecord);
    await refresh(set);
  },

  addEvent: async (event) => {
    await calendarRepository.create(event as CalendarEvent);
    await refresh(set);
  },

  updateEvent: async (id, changes) => {
    await calendarRepository.update(id, changes);
    await refresh(set);
  },

  deleteEvent: async (id) => {
    await calendarRepository.delete(id);
    await refresh(set);
  },

  scheduleTask: async (taskId, date, time) => {
    const task = await taskRepository.get(taskId);
    if (!task || task.status === 'done') return;

    await calendarRepository.deleteByLinkedTaskId(taskId);
    const start = localDateTimeISO(date, time);
    await taskRepository.setScheduled(taskId, start);
    await calendarRepository.create({
      title: task.title,
      kind: 'flexible',
      start,
      end: plusMinutes(start, task.estimatedDuration || 30),
      linkedTaskId: taskId
    } as Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>);
    await refresh(set);
  },

  markTaskDone: async (id) => {
    await taskRepository.markDone(id);
    // الحدّ المرن المربوط بالمهمة لم يعد يحجز مساحة بعد الإنجاز.
    await calendarRepository.deleteByLinkedTaskId(id);
    await refresh(set);
  },

  reopenTask: async (id) => {
    await taskRepository.update(id, { status: 'todo' });
    await refresh(set);
  },

  updateTask: async (id, changes) => {
    await taskRepository.update(id, changes);
    await refresh(set);
  },

  deleteTask: async (id) => {
    await calendarRepository.deleteByLinkedTaskId(id);
    await taskRepository.delete(id);
    await refresh(set);
  },

  replan: async () => {
    const state = get();
    const openTasks = state.tasks.filter((task) => task.status !== 'done');
    const fixedEvents = state.events.filter((event) => event.kind === 'fixed');
    const plan = recomputePlan({ tasks: openTasks, fixedEvents });

    for (const move of plan.moved) {
      await taskRepository.setScheduled(move.taskId, move.scheduledAt);
      await calendarRepository.deleteByLinkedTaskId(move.taskId);
      const task = openTasks.find((item) => item.id === move.taskId);
      if (!task) continue;
      await calendarRepository.create({
        title: task.title,
        kind: 'flexible',
        start: move.scheduledAt,
        end: plusMinutes(move.scheduledAt, task.estimatedDuration || 30),
        linkedTaskId: task.id
      } as Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>);
    }

    const result: ReplanResult = {
      message: plan.message,
      moved: plan.moved,
      untouched: plan.untouched
    };
    set({ lastReplan: result });
    await refresh(set);
    return result;
  }
}));