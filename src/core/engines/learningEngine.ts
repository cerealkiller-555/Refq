// ============================================================
// رِفق — Learning Engine (دوال نقية)
// الخطوة التالية لكل مسار نشط + تحويلها لشكل قابل للاقتراح.
// بلا UI، بلا Dexie — فقط ترتيب وحساب.
// ============================================================

import type { LearningPath, PathItem, Session } from '../types';
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

/** آخر توقف لكل مسار: أحدث جلسة فعلية إن وجدت، وإلا آخر خطوة مُنجزة، وإلا لا شيء.
 *  (نفس القاعدة التي كانت في واجهة خطتي — نُقلت هنا لتكون نقية وقابلة للاختبار) */
export interface LastStop {
  itemTitle: string;
  date: string;
}

export function lastStopByPath(
  paths: LearningPath[],
  itemsByPath: Record<string, PathItem[]>,
  sessions: Session[]
): Map<string, LastStop | null> {
  const map = new Map<string, LastStop | null>();
  const sessionMap = new Map<string, Session[]>();

  for (const session of sessions) {
    const list = sessionMap.get(session.pathItemId) || [];
    list.push(session);
    sessionMap.set(session.pathItemId, list);
  }

  for (const p of paths) {
    const pItems = itemsByPath[p.id] || [];
    const itemMap = new Map(pItems.map((it) => [it.id, it]));

    let latestSession: Session | null = null;
    for (const item of pItems) {
      const itemSessions = sessionMap.get(item.id) || [];
      for (const s of itemSessions) {
        if (!latestSession || new Date(s.date).getTime() > new Date(latestSession.date).getTime()) {
          latestSession = s;
        }
      }
    }

    if (latestSession && itemMap.has(latestSession.pathItemId)) {
      map.set(p.id, {
        itemTitle: itemMap.get(latestSession.pathItemId)!.title,
        date: latestSession.date
      });
    } else {
      const doneItems = pItems.filter((i) => i.status === 'done').sort((a, b) => b.order - a.order);
      if (doneItems.length > 0) {
        map.set(p.id, {
          itemTitle: doneItems[0].title,
          date: doneItems[0].updatedAt
        });
      } else {
        map.set(p.id, null);
      }
    }
  }
  return map;
}

/** عدّاد جلسات المسار الواحد — يُحسب من الجلسات الموجودة فعلًا */
export function pathSessionsCount(items: PathItem[], sessions: Session[]): number {
  if (items.length === 0 || sessions.length === 0) return 0;
  const ids = new Set(items.map((it) => it.id));
  let count = 0;
  for (const s of sessions) {
    if (ids.has(s.pathItemId)) count += 1;
  }
  return count;
}

/** تقدم المسار: عدد مُنجز / إجمالي (للعرض بلطف، بلا أي تقييم) */
export function pathProgress(items: PathItem[]): { done: number; total: number } {
  return {
    done: items.filter((i) => i.status === 'done').length,
    total: items.length
  };
}
