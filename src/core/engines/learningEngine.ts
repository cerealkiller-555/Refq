// ============================================================
// رِفق — Learning Engine (دوال نقية)
// الخطوة التالية لكل مسار نشط + تحويلها لشكل قابل للاقتراح.
// بلا UI، بلا Dexie — فقط ترتيب وحساب.
// ============================================================

import type { LearningPath, PathItem } from '../types';
import { pathItemToSuggestable, type Suggestable } from './suggestionEngine';

export interface NextStep {
  item: PathItem;
  path: LearningPath;
  suggestable: Suggestable;
}

/** حساب رتبة الموعد النهائي في الترتيب: المتأخر أولاً، ثم الأقرب فالأبعد */
function deadlineScore(deadline?: string, nowMs = Date.now()): number {
  if (!deadline) return 0;
  const daysLeft = (new Date(deadline).getTime() - nowMs) / (1000 * 60 * 60 * 24);
  if (daysLeft < 0) return 4; // متأخرة
  if (daysLeft <= 1) return 3; // غداً أو اليوم
  if (daysLeft <= 3) return 2; // قريبة
  if (daysLeft <= 7) return 1; // هذا الأسبوع
  return 0.5; // موعد أبعد
}

/**
 * الخطوة التالية لكل مسار نشط (أول عنصر غير مُنجز بترتيب order).
 * يجيب عن: "ما هو أول ما أكمله في كل مسار؟" — يرتب حسب order ويستبعد المُنجز.
 */
export function nextSteps(
  paths: LearningPath[],
  itemsByPath: Record<string, PathItem[]>,
  now: string = new Date().toISOString()
): NextStep[] {
  const result: NextStep[] = [];
  const nowMs = new Date(now).getTime();

  for (const path of paths) {
    if (path.status !== 'active') continue; // الموقوف/المُنهى لا يُقترح
    const items = itemsByPath[path.id] ?? [];
    const next = items.filter((i) => i.status !== 'done').sort((a, b) => a.order - b.order)[0];
    if (!next) continue;
    result.push({
      item: next,
      path,
      suggestable: pathItemToSuggestable(next, path.title)
    });
  }

  // ترتيب حتمي: أولوية الموعد (المتأخر أولاً ثم الأقرب)، ثم الأقرب زمنيًا عند التساوي،
  // ثم بدون deadline، ثم ترتيب المسار الداخلي، ثم id
  return result.sort((a, b) => {
    const scoreA = deadlineScore(a.item.deadline, nowMs);
    const scoreB = deadlineScore(b.item.deadline, nowMs);
    if (scoreA !== scoreB) return scoreB - scoreA;

    const da = a.item.deadline ? new Date(a.item.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b.item.deadline ? new Date(b.item.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;

    if (a.path.order !== b.path.order) return a.path.order - b.path.order;
    return a.item.id.localeCompare(b.item.id);
  });
}

/** تقدم المسار: عدد مُنجز / إجمالي (للعرض بلطف، بلا أي تقييم) */
export function pathProgress(items: PathItem[]): { done: number; total: number } {
  return {
    done: items.filter((i) => i.status === 'done').length,
    total: items.length
  };
}
