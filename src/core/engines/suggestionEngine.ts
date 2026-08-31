// ============================================================
// رِفق — Suggestion Engine ("ماذا أفعل الآن؟")
// يقترح شيئًا واحدًا فقط بناءً على الوقت المتاح والطاقة والأولوية.
// إن لم يوجد شيء مريح، يقول ذلك بوضوح (الراحة ليست عدو التخطيط).
// ============================================================

import { computePriorityScore } from './priorityEngine';
import type { TaskRecord, EnergyLevel } from '../types';

export interface SuggestionContext {
  availableMinutes: number;
  energy?: EnergyLevel;
  now?: string;
}

export interface SuggestionResult {
  task: TaskRecord | null;
  reason: string;
}

// مدة تشغيل تقريبية لكل طاقة إن لم تُحدد
const DEFAULT_DURATION_BY_ENERGY: Record<EnergyLevel, number> = {
  low: 20,
  medium: 35,
  high: 50
};

/**
 * درجة توافق طاقة المهمة مع طاقة المستخدم.
 */
function energyFitScore(task: TaskRecord, energy?: EnergyLevel): number {
  if (!energy || !task.energyRequired) return 0;
  // طاقة المستخدم أقل من المطلوبة → غير مريح
  if (energy === 'low' && task.energyRequired === 'high') return -2;
  if (energy === 'medium' && task.energyRequired === 'high') return -1;
  if (energy === 'high' && task.energyRequired === 'low') return 1; // طاقة عالية لمهمة خفيفة مقبول
  return 0;
}

/**
 * الاقتراح: مهمة واحدة فقط لا تزيد مدةً عن المتاح.
 * يأخذ الأعلى أولوية مع مراعاة طاقة.
 */
export function suggestTask(
  tasks: TaskRecord[],
  ctx: SuggestionContext
): SuggestionResult {
  if (!tasks.length) {
    return {
      task: null,
      reason: 'لا توجد مهمة مفتوحة الآن.'
    };
  }

  const now = ctx.now ?? new Date().toISOString();
  const candidates = tasks
    .filter((t) => t.status !== 'done')
    .map((task) => {
      const duration = task.estimatedDuration || DEFAULT_DURATION_BY_ENERGY[ctx.energy ?? 'medium'];
      const fit = energyFitScore(task, ctx.energy);
      const score = computePriorityScore(task, now) + fit;
      return { task, duration, score };
    })
    // ضمن المتاح: لا نقترح ما لا يناسب الوقت أبدًا
    .filter((c) => c.duration <= ctx.availableMinutes)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    return {
      task: null,
      reason: 'لا توجد مهمة تستحق أن نضغط عليك بها الآن. يمكنك الراحة أو اختيار شيء خفيف.'
    };
  }

  const top = candidates[0];
  return {
    task: top.task,
    reason: `الوقت المتاح (${ctx.availableMinutes} دقيقة) يكفي لهذه المهمة، والأولوية تدعمها.`
  };
}