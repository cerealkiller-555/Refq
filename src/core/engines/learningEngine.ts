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

/**
 * الخطوة التالية لكل مسار نشط (أول عنصر غير مُنجز بترتيب order).
 * يجيب عن: "ما هو أول ما أكمله في كل مسار؟" — يرتب حسب order ويستبعد المُنجز.
 */
export function nextSteps(
  paths: LearningPath[],
  itemsByPath: Record<string, PathItem[]>
): NextStep[] {
  const result: NextStep[] = [];

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

  // ترتيب حتمي: الأقرب deadline أولًا، ثم الترتيب داخل المسار، ثم id
  return result.sort((a, b) => {
    const da = a.item.deadline ?? '';
    const db = b.item.deadline ?? '';
    if (da && db && da !== db) return da < db ? -1 : 1;
    if (!da && db) return 1;
    if (da && !db) return -1;
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