// ============================================================
// رِفق — Planning Store (المهام + التقويم + إعادة التوزيع)
// P2: CalendarEvent CRUD، جدولة المهام كأحداث مرنة مربوطة،
// وإعادة التوزيع اللطيفة عبر RecoveryEngine — الثوابت لا تُلمس أبدًا.
// ============================================================

import { create } from 'zustand';
import {
  taskRepository,
  calendarRepository
} from '../db/repositories';
import { recomputePlan, type RecoveryPlan } from '../engines/recoveryEngine';
import { localDateTimeISO } from '../engines/calendarEngine';
import type { TaskRecord, CalendarEvent, CalendarEventKind } from '../types';

export interface NewEventData {
  title: string;
  kind: CalendarEventKind;
  dateKey: string; // YYYY-MM-DD محلي
  time: string; // HH:MM
  durationMinutes: number;
  note?: string;
}

interface PlanningState {
  tasks: TaskRecord[];
  events: CalendarEvent[];
  replanResult: RecoveryPlan | null;
  load: () => Promise<void>;
  // ===== مهام =====
  addTask: (task: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  markTaskDone: (id: string) => Promise<void>;
  reopenTask: (id: string) => Promise<void>;
  updateTask: (id: string, changes: Partial<TaskRecord>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  // ===== تقويم =====
  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  addOccurrence: (data: NewEventData) => Promise<void>;
  updateEvent: (id: string, changes: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  // ===== ربط المهام بالتقويم =====
  scheduleTask: (taskId: string, dateKey: string, time: string) => Promise<void>;
  // ===== التعافي =====
  replan: () => Promise<RecoveryPlan>;
  clearReplanResult: () => void;
}

async function refreshEvents(set: (partial: Partial<PlanningState>) => void) {
  const events = await calendarRepository.getAll();
  set({ events });
}

export const usePlanningStore = create<PlanningState>((set) => ({
  tasks: [],
  events: [],
  replanResult: null,

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

  /** إتمام مهمة — وأحداثها المرنة المربوطة تتحرر بلطف */
  markTaskDone: async (id) => {
    await taskRepository.markDone(id);
    await calendarRepository.deleteFlexibleByLinkedTask(id);
    const [tasks, events] = await Promise.all([
      taskRepository.getAll(),
      calendarRepository.getAll()
    ]);
    set({ tasks, events });
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

  addEvent: async (event) => {
    await calendarRepository.create(event as CalendarEvent);
    await refreshEvents(set);
  },

  /** إضافة حدث من نموذج اليوم/الوقت المحلي */
  addOccurrence: async (data) => {
    const start = localDateTimeISO(data.dateKey, data.time);
    const end = new Date(new Date(start).getTime() + data.durationMinutes * 60000).toISOString();
    await calendarRepository.create({
      title: data.title,
      kind: data.kind,
      start,
      end,
      note: data.note
    } as unknown as CalendarEvent);
    await refreshEvents(set);
  },

  updateEvent: async (id, changes) => {
    await calendarRepository.update(id, changes);
    await refreshEvents(set);
  },

  deleteEvent: async (id) => {
    await calendarRepository.delete(id);
    await refreshEvents(set);
  },

  deleteTask: async (id) => {
    await taskRepository.delete(id);
    // أحداثها المرنة المربوطة لم تعد لها معنى
    await calendarRepository.deleteFlexibleByLinkedTask(id);
    const tasks = await taskRepository.getAll();
    const events = await calendarRepository.getAll();
    set({ tasks, events });
  },

  /** جدولة مهمة: scheduledAt + حدث مرن مربوط (يستبدل السابق إن وجد) */
  scheduleTask: async (taskId, dayKey, time) => {
    const task = await taskRepository.get(taskId);
    if (!task) return;
    const start = localDateTimeISO(dayKey, time);
    const duration = task.estimatedDuration || 30;
    const end = new Date(new Date(start).getTime() + duration * 60000).toISOString();

    await calendarRepository.deleteFlexibleByLinkedTask(taskId);
    await calendarRepository.create({
      title: task.title,
      kind: 'flexible',
      start,
      end,
      linkedTaskId: taskId
    } as unknown as CalendarEvent);
    await taskRepository.setScheduled(taskId, start);

    const [tasks, events] = await Promise.all([
      taskRepository.getAll(),
      calendarRepository.getAll()
    ]);
    set({ tasks, events });
  },

  /** إعادة التوزيع اللطيفة — الثوابت لا تُلمس أبدًا */
  replan: async () => {
    const openTasks = await taskRepository.getOpenTasks();
    const fixedEvents = await calendarRepository.getFixed();
    const plan = recomputePlan({
      tasks: openTasks,
      fixedEvents,
      startFrom: new Date().toISOString(),
      days: 7,
      maxMinutesPerDay: 360
    });

    for (const move of plan.moved) {
      await taskRepository.setScheduled(move.taskId, move.scheduledAt);
      await calendarRepository.deleteFlexibleByLinkedTask(move.taskId);
      const task = await taskRepository.get(move.taskId);
      const end = new Date(
        new Date(move.scheduledAt).getTime() + (task?.estimatedDuration || 30) * 60000
      ).toISOString();
      await calendarRepository.create({
        title: task?.title ?? 'مهمة',
        kind: 'flexible',
        start: move.scheduledAt,
        end,
        linkedTaskId: move.taskId
      } as unknown as CalendarEvent);
    }

    const [tasks, events] = await Promise.all([
      taskRepository.getAll(),
      calendarRepository.getAll()
    ]);
    set({ tasks, events, replanResult: plan });
    return plan;
  },

  clearReplanResult: () => set({ replanResult: null })
}));

// مساعد اليوم المحلي — يُصدَّر من هنا للـUI (المصدر في calendarEngine)
export { todayKey } from '../engines/calendarEngine';