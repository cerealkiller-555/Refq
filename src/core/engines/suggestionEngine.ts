// ============================================================
// رِفق — Suggestion Engine ("✨ ماذا أفعل الآن؟")
// يقترح شيئًا واحدًا فقط بناءً على: الوقت المتاح، الطاقة،
// فترة اليوم بين الصلوات (Prayer Anchors)، والأولوية.
// إن لم يوجد شيء مريح يقول ذلك بلطف — الراحة ليست عدو التخطيط.
// ============================================================

import { computePriorityScore, describeTaskFactors, energyFitScore } from './priorityEngine';
import type { TaskRecord, EnergyLevel, PathItem } from '../types';

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
  /** مهمة عادية أو خطوة تعليمية (Suggestable) — ميّز بـ kind */
  task: TaskRecord | Suggestable | null;
  reason: string;
}

/**
 * نوع موحّد للتلمح في "ماذا أفعل الآن؟" — مهمة أو خطوة تعليمية.
 * الحقول الأساسية المشتركة كافية للمحرك (مدة، عنوان، سبب سياقي).
 */
export interface Suggestable {
  id: string;
  title: string;
  estimatedDuration?: number;
  /** سبب سياقي (اختياري) يذكر مصدر الشيء المقترح — مثل اسم المسار التعليمي */
  sourceLabel?: string;
  status: 'todo' | 'in_progress' | 'done';
  // ===== حقول خاصة بالمهام (اختيارية للحفاظ على التوافق مع TaskRecord) =====
  importance?: 'high' | 'low';
  urgency?: 'high' | 'low';
  energyRequired?: EnergyLevel;
  deadline?: string;
  /** أصل العنصر: مهمة عادية أم خطوة تعليمية */
  kind?: 'task' | 'learning';
}

const HEAVY_THRESHOLD_MINUTES = 45;
const DEFAULT_DURATION_BY_ENERGY: Record<EnergyLevel, number> = {
  low: 20,
  medium: 35,
  high: 50
};

/** عنصر ثقيل = يحتاج طاقة عالية أو يتجاوز العتبة */
function isHeavy(item: Pick<Suggestable, 'energyRequired' | 'estimatedDuration'>): boolean {
  return item.energyRequired === 'high' || (item.estimatedDuration ?? 0) > HEAVY_THRESHOLD_MINUTES;
}

/** هل المقترَح خطوة تعليمية (وليست مهمة عادية)؟ — يضيّق النوع بأمان */
export function isLearningItem(
  item: TaskRecord | Suggestable
): item is Suggestable & { kind: 'learning' } {
  return (item as Suggestable).kind === 'learning';
}

/** تحويل PathItem إلى Suggestable مع اسم مساره */
export function pathItemToSuggestable(item: PathItem, pathTitle: string): Suggestable {
  return {
    id: item.id,
    title: item.title,
    estimatedDuration: item.estimatedDuration,
    status: item.status,
    energyRequired: item.energyRequired,
    sourceLabel: pathTitle,
    kind: 'learning'
  };
}

/**
 * الاقتراح: عنصر واحد فقط (مهمة أو خطوة تعليمية).
 * - لا يقترح ما يتجاوز الوقت المتاح ولا نهاية الفترة الحالية بين الصلوات.
 * - wantsLightDay يستبعد المهام/الخطوات الثقيلة.
 */
export function suggestTask(
  items: Array<TaskRecord | Suggestable>,
  ctx: SuggestionContext
): SuggestionResult {
  const now = ctx.now ?? new Date().toISOString();
  const periodRemaining = ctx.period?.remainingMinutes ?? null;
  const periodCapped = periodRemaining !== null;
  const effectiveAvailable =
    periodRemaining !== null ? Math.min(ctx.availableMinutes, periodRemaining) : ctx.availableMinutes;
  const nextLabel = ctx.period?.nextAnchorLabel;

  const open = items.filter((t) => t.status !== 'done');
  if (open.length === 0) {
    return { task: null, reason: 'لا توجد مهمة مفتوحة الآن.' };
  }

  const candidates = open
    .filter((t) => !(ctx.wantsLightDay && isHeavy(t)))
    .map((item) => {
      const duration = item.estimatedDuration || DEFAULT_DURATION_BY_ENERGY[ctx.energy ?? 'medium'];
      const score = computePriorityScore(item as TaskRecord, now, ctx.energy) + energyFitScore(item as TaskRecord, ctx.energy);
      return { task: item, duration, score };
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
  // سبب لخطوة تعليمية يذكر مسارها (بدل عوامل الأهمية/الإلحاح غير الملائمة لها)
  if (isLearningItem(top.task) && top.task.sourceLabel) {
    parts.push(`خطوتك القادمة في ${top.task.sourceLabel}`);
  } else {
    parts.push(...describeTaskFactors(top.task as TaskRecord, now));
  }
  if (ctx.energy && top.task.energyRequired) {
    if (
      energyFitScore(top.task as TaskRecord, ctx.energy) > 0 ||
      (ctx.energy === 'low' && top.task.energyRequired === 'low')
    ) {
      parts.push('تناسب طاقتك');
    } else if (ctx.energy === 'high' && top.task.energyRequired === 'high') {
      parts.push('عميقة وتناسب طاقتك الحالية');
    }
  }
  if (parts.length === 0) parts.push('تناسب وقتك المتاح');

  return { task: top.task as TaskRecord | Suggestable, reason: parts.join(' + ') };
}