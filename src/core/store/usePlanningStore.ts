// ============================================================
// رِفق — Planning Store (المهام + التقويم + إعادة التوزيع)
// P2: CalendarEvent CRUD، جدولة المهام كأحداث مرنة مربوطة،
// وإعادة التوزيع اللطيفة عبر RecoveryEngine — الثوابت لا تُلمس أبدًا.
// ============================================================

import { create } from 'zustand';
import {
  taskRepository,
  calendarRepository,
  googleCalendarRepository
} from '../db/repositories';
import { recomputePlan, type RecoveryPlan } from '../engines/recoveryEngine';
import { localDateTimeISO } from '../engines/calendarEngine';
import { syncWithStoredToken, disconnectGoogleCalendar } from '../integrations/googleCalendar';
import {
  completeTask as completeTaskLifecycle,
  reopenTask as reopenTaskLifecycle,
  deleteTask as deleteTaskLifecycle,
  updateTask as updateTaskLifecycle,
  applySchedule,
  applySchedules,
  enforceTaskEventInvariant,
  onTaskLifecycleChange
} from '../services/taskLifecycle';
import { useActiveTaskStore } from './useActiveTaskStore';
import type { TaskRecord, CalendarEvent, CalendarEventKind } from '../types';

interface NewEventData {
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
  /** أحداث Google Calendar المخزّنة (قراءة فقط — لا تدخل أي عمليات كتابة) */
  googleEvents: CalendarEvent[];
  /** متى آخر مزامنة ناجحة (ISO) — null إن لم يحدث بعد */
  googleSyncAt: string | null;
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
  // ===== مزامنة جوجل (قراءة فقط) =====
  syncGoogle: () => Promise<number>;
  disconnectGoogle: () => Promise<void>;
  // ===== التعافي =====
  replan: () => Promise<RecoveryPlan>;
  clearReplanResult: () => void;
}

async function refreshEvents(set: (partial: Partial<PlanningState>) => void) {
  const events = await calendarRepository.getAll();
  set({ events });
}

/**
 * ترحيل القاعدة: يُنفَّذ **مرّة واحدة في الجلسة** عند أول تحميل.
 * بعدها load قراءة فقط — لا كتابة متكرّرة على كل فتح للشاشة.
 * (كل الكتابات اللاحقة تمرّ عبر taskLifecycle فتبقى القاعدة صحيحة)
 */
let taskInvariantChecked = false;

export const usePlanningStore = create<PlanningState>((set) => ({
  tasks: [],
  events: [],
  replanResult: null,
  googleEvents: [],
  googleSyncAt: null,

  load: async () => {
    // ترحيل القاعدة: أول تحميل في الجلسة يصحّح بيانات قديمة، وما بعده قراءة فقط
    if (!taskInvariantChecked) {
      taskInvariantChecked = true;
      await enforceTaskEventInvariant();
    }
    const [tasks, events, googleEvents] = await Promise.all([
      taskRepository.getAll(),
      calendarRepository.getAll(),
      googleCalendarRepository.getAll()
    ]);
    set({ tasks, events, googleEvents });
  },

  addTask: async (task) => {
    await taskRepository.create(task as TaskRecord);
    const tasks = await taskRepository.getAll();
    set({ tasks });
  },

  /** إتمام مهمة — عبر مسار واحد لكل الشاشات: أحداثها المرنة تتحرر بلطف */
  markTaskDone: async (id) => {
    await completeTaskLifecycle(id);
    const [tasks, events] = await Promise.all([
      taskRepository.getAll(),
      calendarRepository.getAll()
    ]);
    set({ tasks, events });
    await useActiveTaskStore.getState().load();
  },

  /** إعادة فتح — يُعاد بناء حدثها المرن من موعدها (لا شارة بلا حدث) */
  reopenTask: async (id) => {
    await reopenTaskLifecycle(id);
    const [tasks, events] = await Promise.all([
      taskRepository.getAll(),
      calendarRepository.getAll()
    ]);
    set({ tasks, events });
  },

  updateTask: async (id, changes) => {
    await updateTaskLifecycle(id, changes);
    const [tasks, events] = await Promise.all([
      taskRepository.getAll(),
      calendarRepository.getAll()
    ]);
    set({ tasks, events });
    await useActiveTaskStore.getState().load();
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
    const event = await calendarRepository.get(id);
    await calendarRepository.delete(id);
    // حدث مربوط بمهمة ← حذفه يفكّ جدولة المهمة كذلك (لا تبقى شارة «مجدولة» بلا حدث)
    if (event?.linkedTaskId) {
      await taskRepository.update(event.linkedTaskId, { scheduledAt: undefined });
    }
    const [tasks, events] = await Promise.all([
      taskRepository.getAll(),
      calendarRepository.getAll()
    ]);
    set({ tasks, events });
  },

  deleteTask: async (id) => {
    await deleteTaskLifecycle(id);
    const [tasks, events] = await Promise.all([
      taskRepository.getAll(),
      calendarRepository.getAll()
    ]);
    set({ tasks, events });
    await useActiveTaskStore.getState().load();
  },

  /** جدولة مهمة: scheduledAt + حدث مرن مربوط (يستبدل السابق إن وجد) — عبر المسار الموحّد */
  scheduleTask: async (taskId, dayKey, time) => {
    const task = await taskRepository.get(taskId);
    if (!task) return;
    await applySchedule(taskId, localDateTimeISO(dayKey, time));
    const [tasks, events] = await Promise.all([
      taskRepository.getAll(),
      calendarRepository.getAll()
    ]);
    set({ tasks, events });
  },

  /**
   * مزامنة قراءة فقط مع Google Calendar: جلب النطاق الزمني ثم استبدال الكاش.
   * يعيد عدد الأحداث المخزّنة. الفشل يرمي خطأ يعالجه الـUI بلطف.
   */
  syncGoogle: async () => {
    const result = await syncWithStoredToken();
    await googleCalendarRepository.replaceAll(result.events);
    set({ googleEvents: result.events, googleSyncAt: result.syncedAt });
    return result.events.length;
  },

  /** قطع الاتصال: إسقاط الرمز من الذاكرة + تفريغ الكاش المعروض */
  disconnectGoogle: async () => {
    await disconnectGoogleCalendar();
    await googleCalendarRepository.replaceAll([]);
    set({ googleEvents: [], googleSyncAt: null });
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

    // دفعة واحدة عبر المسار الموحّد — إشعار واحد بعد الكل
    await applySchedules(plan.moved.map((m) => ({ taskId: m.taskId, startISO: m.scheduledAt })));

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

// أي تغيّر في دورة حياة المهمة من شاشة أخرى ← إعادة قراءة المهام والأحداث هنا (قراءات فقط)
onTaskLifecycleChange(() => {
  void (async () => {
    const [tasks, events] = await Promise.all([
      taskRepository.getAll(),
      calendarRepository.getAll()
    ]);
    usePlanningStore.setState({ tasks, events });
  })().catch(() => {
    // قاعدة مغلقة أثناء الإيقاف — التحميل القادم يصحح
  });
});