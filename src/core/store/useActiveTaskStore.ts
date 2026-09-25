// ============================================================
// رِفق — Active Task Store (المهمة الجارية — واحدة فقط + مؤقت تركيز)
// مصدر الحقيقة: حالة in_progress في الـDB (مهام + خطوات مسارات).
// المؤقت: يبدأ مع المهمة، يُحسب من startedAt الحقيقي (لا يُعاد من الصفر)،
// الإيقاف ⏸ يجمد العد بدقة عبر pausedTotalMs، ويُحفظ في localStorage.
// الإخفاء (×) مؤقت في الذاكرة فقط — المهمة تفضل محفوظة ومستمرة.
// كل عمليات البيانات عبر Repositories — لا Dexie هنا.
// ============================================================

import { create } from 'zustand';
import { pathItemRepository, sessionRepository, taskRepository } from '../db/repositories';

type ActiveKind = 'task' | 'learning';

interface ActiveItem {
  id: string;
  kind: ActiveKind;
  title: string;
}

export interface ActiveTimer {
  id: string; // المهمة المرتبطة بالمؤقت
  plannedMinutes: number;
  startedAt: string; // ISO — لحظة البدء الحقيقية
  pausedAt: string | null; // ISO — لحظة الإيقاف الحالي (null = شغال)
  pausedTotalMs: number; // مجموع فترات الإيقاف المنتهية
}

interface PendingStart {
  id: string;
  kind: ActiveKind;
  title: string;
  minutes?: number;
}

const TIMER_KEY = 'refq.active.timer';

/** الوقت المتبقي بالميلي ثانية — دالة نقية (قابلة للاختبار) */
export function remainingMs(t: ActiveTimer, nowMs: number): number {
  const ref = t.pausedAt ? new Date(t.pausedAt).getTime() : nowMs;
  const elapsed = ref - new Date(t.startedAt).getTime() - t.pausedTotalMs;
  const total = t.plannedMinutes * 60_000;
  // مقيّد بين صفر والمدة الأصلية — قيمة محفوظة تالفة لا تُظهر وقتًا أكبر من المخطط
  return Math.min(total, Math.max(0, total - elapsed));
}

function loadStoredTimer(): ActiveTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? (JSON.parse(raw) as ActiveTimer) : null;
  } catch {
    return null;
  }
}

function saveStoredTimer(t: ActiveTimer | null): void {
  try {
    if (t) localStorage.setItem(TIMER_KEY, JSON.stringify(t));
    else localStorage.removeItem(TIMER_KEY);
  } catch {
    // بلا تخزين — لا يكسر أبدًا
  }
}

interface ActiveTaskState {
  active: ActiveItem | null;
  loaded: boolean;
  /** إخفاء مؤقت للشريط فقط — لا يمس المهمة في الـDB إطلاقًا */
  hidden: boolean;
  /** طلب بدء معلّق — ينتظر قرار المستخدم (استبدال/رجوع) */
  pending: PendingStart | null;
  timer: ActiveTimer | null;
  load: () => Promise<void>;
  /** بدء عنصر — لو فيه جارية غيره يعلّق الطلب بدل التنفيذ */
  startItem: (id: string, kind: ActiveKind, title: string, minutes?: number) => Promise<void>;
  confirmReplace: () => Promise<void>;
  cancelPending: () => void;
  completeActive: () => Promise<void>;
  dismiss: () => void;
  unhide: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  clearTimer: () => void;
  /** تسجيل جلسة للخطوة التعليمية الجارية بمدة المؤقت */
  logSession: () => Promise<void>;
}

/** قراءة المهمة الجارية الوحيدة من الـDB (الأولوية للمهام ثم خطوات المسارات) */
async function readActive(): Promise<ActiveItem | null> {
  try {
    const tasks = await taskRepository.getOpenTasks();
    const runningTask = tasks.find((t) => t.status === 'in_progress');
    if (runningTask) {
      return { id: runningTask.id, kind: 'task', title: runningTask.title };
    }
  } catch {
    // قاعدة مغلقة/خطأ ← نكمل للفحص التالي بلا انهيار
  }
  try {
    const items = await pathItemRepository.getAll();
    const runningItem = items.find((i) => i.status === 'in_progress');
    if (runningItem) {
      return { id: runningItem.id, kind: 'learning', title: runningItem.title };
    }
  } catch {
    // بلا خطوات — طبيعي
  }
  return null;
}

export const useActiveTaskStore = create<ActiveTaskState>((set, get) => {
  /** ضبط مؤقت جديد لعنصر بدأ الآن */
  const setTimerFor = (id: string, minutes?: number): ActiveTimer => {
    const timer: ActiveTimer = {
      id,
      plannedMinutes: minutes && minutes > 0 ? minutes : 30,
      startedAt: new Date().toISOString(),
      pausedAt: null,
      pausedTotalMs: 0
    };
    saveStoredTimer(timer);
    return timer;
  };

  return {
    active: null,
    loaded: false,
    hidden: false,
    pending: null,
    timer: null,

    load: async () => {
      const active = await readActive();
      // استرجاع المؤقت المحفوظ — يُصحَّح إن أُتمّت المهمة الجارية أو استُبدلت
      let timer = loadStoredTimer();
      if (timer && (!active || timer.id !== active.id)) {
        timer = null;
        saveStoredTimer(null);
      }
      // طلب استبدال بلا مهمة جارية = فقد سياقه (أُنجزت من شاشة أخرى) ← لا نعرضه
      set({ active, loaded: true, timer, pending: active ? get().pending : null });
    },

    startItem: async (id, kind, title, minutes) => {
      // نضمن حداثة القراءة — فشلها لا يمنع الفحص
      if (!get().loaded) await get().load();
      const current = get().active;
      if (current && current.id !== id) {
        // قاعدة الواحدة فقط: نعرض الخيار بدل التنفيذ الصامت —
        // ومع إظهار الشريط، فلا يضيع السؤال إن كان مخفيًا بـ×
        set({ pending: { id, kind, title, minutes }, hidden: false });
        return;
      }
      if (current?.id === id) {
        set({ hidden: false, pending: null });
        return;
      }
      if (kind === 'learning') {
        await pathItemRepository.update(id, { status: 'in_progress' });
      } else {
        await taskRepository.update(id, { status: 'in_progress' });
      }
      const timer = setTimerFor(id, minutes);
      set({ hidden: false, timer, pending: null });
      await get().load();
    },

    confirmReplace: async () => {
      const { pending, active } = get();
      if (!pending) return;
      // المهمة الحالية ترجع todo بهدوء — لم تُحذف ولم تُلغَ
      if (active) {
        try {
          if (active.kind === 'learning') {
            await pathItemRepository.update(active.id, { status: 'todo' });
          } else {
            await taskRepository.update(active.id, { status: 'todo' });
          }
        } catch {
          // فشل الرجوع لا يمنع بدء الجديدة
        }
      }
      if (pending.kind === 'learning') {
        await pathItemRepository.update(pending.id, { status: 'in_progress' });
      } else {
        await taskRepository.update(pending.id, { status: 'in_progress' });
      }
      const timer = setTimerFor(pending.id, pending.minutes);
      set({ pending: null, hidden: false, timer });
      await get().load();
    },

    cancelPending: () => set({ pending: null }),

    completeActive: async () => {
      const { active } = get();
      if (!active) return;
      try {
        if (active.kind === 'learning') {
          await pathItemRepository.update(active.id, { status: 'done' });
        } else {
          await taskRepository.complete(active.id);
        }
      } catch {
        // فشل الإنجاز ← يبقى الشريط كما هو
        return;
      }
      saveStoredTimer(null);
      set({ timer: null });
      await get().load();
    },

    dismiss: () => set({ hidden: true }),
    unhide: () => set({ hidden: false }),

    pauseTimer: () => {
      const { timer } = get();
      if (!timer || timer.pausedAt) return;
      const next: ActiveTimer = { ...timer, pausedAt: new Date().toISOString() };
      saveStoredTimer(next);
      set({ timer: next });
    },

    resumeTimer: () => {
      const { timer } = get();
      if (!timer || !timer.pausedAt) return;
      const pausedMs = Date.now() - new Date(timer.pausedAt).getTime();
      const next: ActiveTimer = {
        ...timer,
        pausedAt: null,
        pausedTotalMs: timer.pausedTotalMs + pausedMs
      };
      saveStoredTimer(next);
      set({ timer: next });
    },

    clearTimer: () => {
      saveStoredTimer(null);
      set({ timer: null });
    },

    logSession: async () => {
      const { active, timer } = get();
      if (!active || active.kind !== 'learning') return;
      try {
        await sessionRepository.create({
          pathItemId: active.id,
          date: new Date().toISOString(),
          durationMinutes: timer?.plannedMinutes ?? 30
        } as Parameters<typeof sessionRepository.create>[0]);
      } catch {
        // فشل التسجيل لا يكسر — المؤقت يُمسح على أي حال
      }
      get().clearTimer();
    }
  };
});
