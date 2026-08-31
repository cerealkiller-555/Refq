// ============================================================
// رِفق — Priority Engine (محرك الأولويات)
// دالة نقيّة: تأخذ مهام وتُرجعها مرتبة.
// الأساس: importance × urgency مع وزن deadline قريب.
// لا يقيس القلب ولا يحكم، فقط يُرتّب العمل الملموس.
// ============================================================

import type { TaskRecord } from '../types';

export interface PriorityInput {
  task: TaskRecord;
  now: string; // ISO
}

/**
 * درجة الأولوية (رقم أعلى = أولوية أعلى).
 * التصميم بسيط تدريجي ويقبل التطوير (الوزن حسب الطاقة، الحجم، الأداء...)
 */
export function computePriorityScore(task: TaskRecord, now: string = new Date().toISOString()): number {
  let score = 0;

  // وزن الأهمية
  score += task.importance === 'high' ? 3 : 1;

  // وزن الإلحاح
  score += task.urgency === 'high' ? 3 : 1;

  // قرب الموعد النهائي (deadline) يعطي رفعًا إضافيًا
  if (task.deadline) {
    const nowMs = new Date(now).getTime();
    const deadlineMs = new Date(task.deadline).getTime();
    const daysLeft = (deadlineMs - nowMs) / (1000 * 60 * 60 * 24);
    if (daysLeft >= 0 && daysLeft <= 1) {
      score += 3; // خلال يوم
    } else if (daysLeft <= 3) {
      score += 2; // خلال 3 أيام
    } else if (daysLeft <= 7) {
      score += 1; // خلال أسبوع
    }
  }

  // المهام المكتملة لا تُعرض
  if (task.status === 'done') {
    return -1;
  }

  return score;
}

/**
 * ترتيب مهام حسب الأولوية.
 * يعيد قائمة مصنّفة تنازليًا مع درجة كل مهمة.
 */
export function rankTasks(tasks: TaskRecord[], now?: string): Array<{ task: TaskRecord; score: number }> {
  return tasks
    .filter((t) => t.status !== 'done')
    .map((task) => ({ task, score: computePriorityScore(task, now) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * أهم 3 مهام للأعلى (Top 3 Priorities).
 */
export function getTopPriorities(tasks: TaskRecord[], n = 3, now?: string): TaskRecord[] {
  return rankTasks(tasks, now)
    .map((entry) => entry.task)
    .slice(0, n);
}