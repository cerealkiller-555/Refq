// ============================================================
// رِفق — Priority Engine (محرك الأولويات)
// دالات نقية: تأخذ مهام وتُرجعها مرتبة + سببًا مقروءًا.
// الأساس: importance × urgency مع وزن deadline قريب وملاءمة الطاقة.
// لا يعرض أرقامًا للمستخدمة — أسباب فقط ("الموعد قريب + المهمة مهمة").
// لا يقيس القلب ولا يحكم — يرتب العمل الملموس فقط.
// ============================================================

import type { TaskRecord, EnergyLevel } from '../types';

/** توافق طاقة المهمة مع طاقة المستخدمة (مُشارك مع SuggestionEngine) */
export function energyFitScore(task: TaskRecord, energy?: EnergyLevel): number {
  if (!energy || !task.energyRequired) return 0;
  if (energy === 'low' && task.energyRequired === 'high') return -2;
  if (energy === 'medium' && task.energyRequired === 'high') return -1;
  if (energy === 'high' && task.energyRequired === 'low') return 1;
  return 0;
}

/**
 * درجة الأولوية (رقم أعلى = أولوية أعلى) — للاستخدام الداخلي فقط، لا تُعرض.
 * energy اختيارية ترفع/تخفض حسب الملاءمة.
 */
export function computePriorityScore(
  task: TaskRecord,
  now: string = new Date().toISOString(),
  energy?: EnergyLevel
): number {
  if (task.status === 'done') return -1;

  let score = 0;
  score += task.importance === 'high' ? 3 : 1;
  score += task.urgency === 'high' ? 3 : 1;

  if (task.deadline) {
    const daysLeft = (new Date(task.deadline).getTime() - new Date(now).getTime()) / (1000 * 60 * 60 * 24);
    if (daysLeft >= 0 && daysLeft <= 1) score += 3;
    else if (daysLeft <= 3) score += 2;
    else if (daysLeft <= 7) score += 1;
  }

  score += energyFitScore(task, energy);
  return score;
}

/** عوامل السبب بصياغة رِفق — قصيرة، بلا أرقام، بلا لوم */
export function describeTaskFactors(task: TaskRecord, now: string): string[] {
  const parts: string[] = [];
  if (task.deadline) {
    const daysLeft = (new Date(task.deadline).getTime() - new Date(now).getTime()) / (1000 * 60 * 60 * 24);
    if (daysLeft >= 0 && daysLeft <= 1) parts.push('الموعد غدًا');
    else if (daysLeft <= 3) parts.push('الموعد قريب');
    else if (daysLeft <= 7) parts.push('الموعد هذا الأسبوع');
  }
  if (task.importance === 'high') parts.push('المهمة مهمة');
  if (task.urgency === 'high') parts.push('عاجلة');
  return parts;
}

/** سبب مختصر قابل للعرض مباشرة */
export function describeReason(task: TaskRecord, now: string = new Date().toISOString()): string {
  const parts = describeTaskFactors(task, now);
  return parts.length ? parts.join(' + ') : 'ضمن مهام يومك بهدوء';
}

function deadlineSortKey(task: TaskRecord): number {
  return task.deadline ? new Date(task.deadline).getTime() : Number.MAX_SAFE_INTEGER;
}

/**
 * الترتيب: score تنازليًا ← الموعد الأقرب ← الأقدم إنشاءً ← id.
 * حتمي تمامًا حتى في التعادل (قابل للاختبار).
 */
export function rankTasks(
  tasks: TaskRecord[],
  now?: string,
  energy?: EnergyLevel
): Array<{ task: TaskRecord; score: number }> {
  const at = now ?? new Date().toISOString();
  return tasks
    .filter((t) => t.status !== 'done')
    .map((task) => ({ task, score: computePriorityScore(task, at, energy) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        deadlineSortKey(a.task) - deadlineSortKey(b.task) ||
        a.task.createdAt.localeCompare(b.task.createdAt) ||
        a.task.id.localeCompare(b.task.id)
    );
}

/** أهم n مهام (Top priorities) */
export function getTopPriorities(tasks: TaskRecord[], n = 3, now?: string, energy?: EnergyLevel): TaskRecord[] {
  return rankTasks(tasks, now, energy)
    .map((entry) => entry.task)
    .slice(0, n);
}