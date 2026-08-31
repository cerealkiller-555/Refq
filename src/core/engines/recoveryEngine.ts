// ============================================================
// رِفق — Recovery Engine (إعادة التوزيع بعد يوم فائت/تعثر)
// الفلسفة: لا عقاب، لا guilt، لا كدس أوتوماتيكي بعد يوم ضائع.
// يقوم بإعادة توزيع المتبقي على الأيام القادمة مع حماية الثوابت:
//   - الأحداث الثابتة لا تتحرك أبدًا (إلا بموافقة صريحة)
//   - السقف اليومي واقعي (لا ضغط)
//   - يحافظ على الراحة
// ============================================================

import type { TaskRecord, CalendarEvent } from '../types';

export interface RecoveryInput {
  tasks: TaskRecord[]; // المهام المفتوحة (todo/in_progress)
  fixedEvents?: CalendarEvent[]; // أحداث ثابتة (لا تتحرك)
  startFrom?: string; // ISO تاريخ بدء التوزيع
  days?: number; // عدد الأيام للنظر
  maxMinutesPerDay?: number;
}

export interface RecoveryPlan {
  moved: Array<{ taskId: string; scheduledAt: string }>;
  untouched: Array<{ taskId: string; reason: string }>;
  message: string; // أسلوب رِفق — لا جلد
  generatedAt: string;
}

// عتبة تفادي الضغط: لا نراكم فوق سقف اليوم (نستخدمها كإزاحة بسيطة للجدولة)
const BUFFER_MINUTES = 15;

function minutesToISOOnDay(dayDate: string, minutes: number): string {
  // dayDate بصيغة YYYY-MM-DD، نضع 9 صباحًا + buffer ثم الدقائق المتراكمة
  const base = new Date(`${dayDate}T09:00:00`);
  base.setMinutes(base.getMinutes() + BUFFER_MINUTES + minutes);
  return base.toISOString();
}

/**
 * إعادة توزيع المهام المتبقية على الأيام القادمة.
 * - يراعي السقف اليومي الحقيقي (سعة تفاعلية تتراكم لكل يوم)
 * - يتجاوز الأيام المضغوطة بأحداث ثابتة دون تجاوز السقف
 * - لا يحرك ثابتًا أبدًا
 */
export function recomputePlan(input: RecoveryInput): RecoveryPlan {
  const now = input.startFrom ?? new Date().toISOString();
  const startDay = now.slice(0, 10);
  const days = input.days ?? 5;
  const maxPerDay = input.maxMinutesPerDay ?? 360;

  const fixedEvents = input.fixedEvents ?? [];

  // السعة الفعلية لكل يوم = السقف - مدة الأحداث الثابتة الظاهرة فيه
  function availableForDay(day: string): number {
    const dayEvents = fixedEvents.filter((e) => e.start.slice(0, 10) === day && e.kind === 'fixed');
    const busy = dayEvents.reduce((sum, e) => {
      const s = new Date(e.start).getTime();
      const en = new Date(e.end).getTime();
      return sum + Math.max(0, (en - s) / 60000);
    }, 0);
    return Math.max(0, maxPerDay - busy);
  }

  const openTasks = input.tasks.filter((t) => t.status !== 'done');

  const moved: RecoveryPlan['moved'] = [];
  const untouched: RecoveryPlan['untouched'] = [];

  // نتابع الاستخدام التراكمي لكل يوم (من اليوم القادم إلى horizon)
  const usedByDay = new Map<string, number>();

  for (const task of openTasks) {
    const duration = task.estimatedDuration || 30;
    if (duration > maxPerDay) {
      untouched.push({ taskId: task.id, reason: 'المدة تفوق السقف اليومي' });
      continue;
    }

    let assigned = false;
    let guard = 0;
    let offset = 1; // نبدأ من الغد (لا نوزع على اليوم الذي فات بالفعل)
    while (!assigned && guard < days && offset <= days) {
      const dayDate = new Date(`${startDay}T00:00:00Z`);
      dayDate.setUTCDate(dayDate.getUTCDate() + offset);
      const dayKey = dayDate.toISOString().slice(0, 10);

      const cap = availableForDay(dayKey);
      const used = usedByDay.get(dayKey) ?? 0;

      if (used + duration <= cap) {
        moved.push({ taskId: task.id, scheduledAt: minutesToISOOnDay(dayKey, used) });
        usedByDay.set(dayKey, used + duration);
        assigned = true;
      } else {
        offset += 1;
        guard += 1;
      }
    }
    if (!assigned) {
      untouched.push({ taskId: task.id, reason: 'لا يوم متاح ضمن النطاق دون تجاوز السقف' });
    }
  }

  return {
    moved,
    untouched,
    message:
      'لم نكمل البارحة؟ لا بأس. أعدنا توزيع ما تبقّى على الأيام القادمة بلطف، وحافظنا على ثوابتك وراحتك.',
    generatedAt: now
  };
}