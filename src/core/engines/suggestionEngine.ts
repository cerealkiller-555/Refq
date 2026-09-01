// ============================================================
// رِفق — Suggestion Engine ("✨ ماذا أفعل الآن؟")
// يقترح شيئًا واحدًا فقط بناءً على: الوقت المتاح، الطاقة،
// فترة اليوم بين الصلوات (Prayer Anchors)، والأولوية.
// إن لم يوجد شيء مريح يقول ذلك بلطف — الراحة ليست عدو التخطيط.
// ============================================================

import { computePriorityScore, describeTaskFactors, energyFitScore } from './priorityEngine';
import type { TaskRecord, EnergyLevel } from '../types';

/** فترة اليوم الحالية (من مراسي الصلوات) — اختيارية تمامًا */
export interface SuggestionPeriod {
  /** المتبقي في الفترة؛ null = مفتوحة بلا سقف (ليل بعد العشاء) */
  remainingMinutes: number | null;
  /** اسم المرساة القادمة (مثل "المغرب") للاستخدام في السبب */
  nextAnchorLabel?: string;
}

export interface SuggestionContext {
  availableMinutes: number;
  energy?: EnergyLevel;
  wantsLightDay?: boolean;
  period?: SuggestionPeriod;
  now?: string;
}

export interface SuggestionResult {
  task: TaskRecord | null;
  reason: string;
}

const HEAVY_TASK_MINUTES = 45;
const DEFAULT_DURATION_BY_ENERGY: Record<EnergyLevel, number> = {
  low: 20,
  medium: 35,
  high: 50
};

/** مهمة ثقيلة = تحتاج طاقة عالية أو تتجاوز العتبة */
function isHeavy(task: TaskRecord): boolean {
  return task.energyRequired === 'high' || (task.estimatedDuration ?? 0) > HEAVY_TASK_MINUTES;
}

/**
 * الاقتراح: مهمة واحدة فقط.
 * - لا يقترح ما يتجاوز الوقت المتاح ولا نهاية الفترة الحالية بين الصلوات.
 * - wantsLightDay يستبعد المهام الثقيلة.
 */
export function suggestTask(tasks: TaskRecord[], ctx: SuggestionContext): SuggestionResult {
  const now = ctx.now ?? new Date().toISOString();
  const periodRemaining = ctx.period?.remainingMinutes ?? null;
  const periodCapped = periodRemaining !== null;
  const effectiveAvailable =
    periodRemaining !== null ? Math.min(ctx.availableMinutes, periodRemaining) : ctx.availableMinutes;
  const nextLabel = ctx.period?.nextAnchorLabel;

  const open = tasks.filter((t) => t.status !== 'done');
  if (open.length === 0) {
    return { task: null, reason: 'لا توجد مهمة مفتوحة الآن.' };
  }

  const candidates = open
    .filter((t) => !(ctx.wantsLightDay && isHeavy(t)))
    .map((task) => {
      const duration = task.estimatedDuration || DEFAULT_DURATION_BY_ENERGY[ctx.energy ?? 'medium'];
      const score = computePriorityScore(task, now, ctx.energy) + energyFitScore(task, ctx.energy);
      return { task, duration, score };
    })
    .filter((c) => c.duration <= effectiveAvailable)
    .sort((a, b) => b.score - a.score || a.task.id.localeCompare(b.task.id));

  if (!candidates.length) {
    if (ctx.wantsLightDay) {
      return {
        task: null,
        reason: 'اخترتِ يومًا خفيفًا — لا شيء يستحق الضغط اليوم. الراحة جزء من الخطة 🤍'
      };
    }
    if (periodCapped && nextLabel) {
      return {
        task: null,
        reason: `لا توجد مهمة تُنجز قبل ${nextLabel}. يمكنك الراحة أو شيء خفيف بعدها.`
      };
    }
    return {
      task: null,
      reason: 'لا توجد مهمة تستحق أن نضغط عليك بها الآن. يمكنك الراحة أو اختيار شيء خفيف.'
    };
  }

  const top = candidates[0];
  const parts: string[] = [];
  if (periodCapped && nextLabel) parts.push(`الوقت قبل ${nextLabel} محدود`);
  parts.push(...describeTaskFactors(top.task, now));
  if (ctx.energy && top.task.energyRequired) {
    if (
      energyFitScore(top.task, ctx.energy) > 0 ||
      (ctx.energy === 'low' && top.task.energyRequired === 'low')
    ) {
      parts.push('تناسب طاقتك');
    } else if (ctx.energy === 'high' && top.task.energyRequired === 'high') {
      parts.push('عميقة وتناسب طاقتك الحالية');
    }
  }
  if (parts.length === 0) parts.push('تناسب وقتك المتاح');

  return { task: top.task, reason: parts.join(' + ') };
}