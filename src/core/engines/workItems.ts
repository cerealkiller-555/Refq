// ============================================================
// رِفق — Work Items (عناصر العمل الموحّدة)
// طبقة قراءة نقية للأولويات: تدمج المهام الحرة وخطوات المسارات
// دون دمج جداول قاعدة البيانات، وبلا كتابة إلى Dexie.
// ============================================================

import { computePriorityScore, describeTaskFactors } from './priorityEngine';
import type { TaskRecord, LearningPath, PathItem } from '../types';
import { nextSteps } from './learningEngine';

/** مصدر العنصر الموحّد — يُميِّز بين المهمة الحرة وخطوة التعلّم */
export type WorkItemKind = 'task' | 'learning';

/** عنصر عمل موحّد للعرض في قائمة أولويات صفحة اليوم */
export interface WorkItem {
  /** المعرّف الأصلي للصف (مهمّة أو خطوة) */
  id: string;
  kind: WorkItemKind;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  deadline?: string; // ISO date — فقط إن وُجدت قيمة فعلية صالحة
  estimatedDuration?: number; // دقائق
  energyRequired?: 'low' | 'medium' | 'high';
  /** اسم المسار المرتبط (للعرض فقط مع خطوات التعلّم) */
  sourceLabel?: string;
  pathId?: string; // معرف المسار للخطوة فقط
  /** تاريخ الإنشاء إن توفّر فعليًا (لا يُخترع للخطوات إن غاب) */
  createdAt?: string;
  importance?: 'high' | 'low'; // للمهام الحرة فقط
  urgency?: 'high' | 'low'; // للمهام الحرة فقط
  /** السجل الأصلي للرجوع إليه عند الحاجة */
  original: TaskRecord | PathItem;
}

/** مفتاح عرض مركب من النوع والمعرّف — يُستخدم عند الحاجة למفتاح React إلخ */
export function workItemKey(item: WorkItem): string {
  return `${item.kind}:${item.id}`;
}

/** تحويل مهمة حرة إلى عنصر عمل موحّد (يُحفظ كل حقولها الأصلية) */
export function taskToWorkItem(task: TaskRecord): WorkItem {
  return {
    id: task.id,
    kind: 'task',
    title: task.title,
    status: task.status,
    deadline: task.deadline,
    estimatedDuration: task.estimatedDuration,
    energyRequired: task.energyRequired,
    sourceLabel: undefined,
    pathId: undefined,
    createdAt: task.createdAt,
    importance: task.importance,
    urgency: task.urgency,
    original: task
  };
}

/** تحويل خطوة تعلّم إلى عنصر عمل موحّد مع اسم مسارها للعرض */
export function pathItemToWorkItem(item: PathItem, pathTitle: string): WorkItem {
  return {
    id: item.id,
    kind: 'learning',
    title: item.title,
    status: item.status,
    deadline: item.deadline,
    estimatedDuration: item.estimatedDuration,
    energyRequired: item.energyRequired,
    sourceLabel: pathTitle,
    pathId: item.pathId,
    // لا يُخترع createdAt للخطوات إن غابت القيمة الفعلية
    createdAt: undefined,
    importance: undefined,
    urgency: undefined,
    original: item
  };
}

/**
 * دمج المهام الحرة المفتوحة مع الخطوة التالية القابلة للتنفيذ من كل مسار تعلّم نشط.
 * لا يستبعد أي مهمة حرة بسبب linkedPathItemId — جميع المهام المفتوحة تبقى.
 * لا تُدخل جميع خطوات المسارات، بل خطوة واحدة فقط لكل مسار نشط عبر nextSteps().
 */
export function getWorkItems(
  tasks: TaskRecord[],
  paths: LearningPath[],
  itemsByPath: Record<string, PathItem[]>
): WorkItem[] {
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const workItems: WorkItem[] = openTasks.map(taskToWorkItem);

  const steps = nextSteps(paths, itemsByPath);
  for (const step of steps) {
    workItems.push(pathItemToWorkItem(step.item, step.path.title));
  }

  return workItems;
}

/**
 * درجة الأولوية لعنصر العمل — تعيد استخدام computePriorityScore الحالية دون تغيير أوزانها.
 * للمهام الحرة تُحسب الدرجة كالمعتاد. للخطوات التعليمية تُعامل الأهمية/العجلة
 * كمتعادلة (صفر نقاط) لأنّ الحقل غير موجود لديها، فلا تُمنح أولوية زائفة.
 */
export function computeWorkItemScore(
  item: WorkItem,
  now: string = new Date().toISOString(),
  energy?: 'low' | 'medium' | 'high'
): number {
  if (item.status === 'done') return -1;

  if (item.kind === 'task') {
    const task = item.original as TaskRecord;
    return computePriorityScore(task, now, energy);
  }

  // خطوة تعلّم: الأهمية/العجلة غير متوفّرة → treated as neutral (0 points)
  let score = 0;
  // لا نضيف نقاط أهمية/عجلة للخطوة لأنّ البيانات غير موجودة لديها
  if (item.deadline) {
    const daysLeft = (new Date(item.deadline).getTime() - new Date(now).getTime()) / (1000 * 60 * 60 * 24);
    if (daysLeft < 0) score += 4;
    else if (daysLeft <= 1) score += 3;
    else if (daysLeft <= 3) score += 2;
    else if (daysLeft <= 7) score += 1;
  }
  // ملاءمة الطاقة إن وُجدت
  score += (item.energyRequired && energy)
    ? (() => {
        if (energy === 'low' && item.energyRequired === 'high') return -2;
        if (energy === 'medium' && item.energyRequired === 'high') return -1;
        if (energy === 'high' && item.energyRequired === 'low') return 1;
        return 0;
      })()
    : 0;
  return score;
}

/** مفتاح ترتيب الموعد: الموعد الصالح الأقرب أولاً؛ المتأخر قبل المستقبل. null = آخروية. */
function deadlineSortKey(item: WorkItem): number {
  return item.deadline ? new Date(item.deadline).getTime() : Number.MAX_SAFE_INTEGER;
}

/**
 * الترتيب حتميًا:
 * 1. الدرجة تنازليًا
 * 2. الموعد الأقرب (فقط إن وُجدت قيمة فعلية صالحة)
 * 3. العنصر الجاري تنفيذه (in_progress) عند التعادل
 * 4. الأقدم إنشاءً (فقط إن توفّر createdAt فعليًا؛ لا تُخترع قيمة)
 * 5. المعرّف لكسر التعادل النهائي
 */
export function rankWorkItems(
  items: WorkItem[],
  now?: string,
  energy?: 'low' | 'medium' | 'high'
): Array<{ item: WorkItem; score: number }> {
  const at = now ?? new Date().toISOString();
  return items
    .filter((i) => i.status !== 'done')
    .map((item) => ({ item, score: computeWorkItemScore(item, at, energy) }))
    .sort((a, b) =>
      b.score - a.score ||
      deadlineSortKey(a.item) - deadlineSortKey(b.item) ||
      // in_progress أولًا عند التعادل في الدرجة والموعد
      (a.item.status === 'in_progress' ? 0 : 1) - (b.item.status === 'in_progress' ? 0 : 1) ||
      // createdAt فقط إن توفّر لكليهما؛ وإلا 0 للسقوط إلى المعرّف
      (a.item.createdAt && b.item.createdAt
        ? a.item.createdAt.localeCompare(b.item.createdAt)
        : 0) ||
      a.item.id.localeCompare(b.item.id)
    );
}

/** أعلى n عناصر أولوية */
export function getTopWorkItems(
  items: WorkItem[],
  n = 3,
  now?: string,
  energy?: 'low' | 'medium' | 'high'
): WorkItem[] {
  return rankWorkItems(items, now, energy).map((entry) => entry.item).slice(0, n);
}

/** سبب العرض لعنصر العمل — True فقط إن دعمته بيانات العنصر */
export function describeWorkReason(item: WorkItem, now: string = new Date().toISOString()): string {
  if (item.kind === 'learning') {
    const parts: string[] = [];
    if (item.sourceLabel) parts.push(`من مسار: ${item.sourceLabel}`);
    if (item.deadline) {
      const daysLeft = (new Date(item.deadline).getTime() - new Date(now).getTime()) / (1000 * 60 * 60 * 24);
      if (daysLeft < 0) parts.push('متأخرة عن موعدها');
      else if (daysLeft <= 1) parts.push('الموعد غدًا');
      else if (daysLeft <= 3) parts.push('الموعد قريب');
      else if (daysLeft <= 7) parts.push('الموعد هذا الأسبوع');
    }
    return parts.length ? parts.join(' + ') : 'خطوة قادمة في مسارك';
  }
  return describeTaskFactors(item.original as TaskRecord, now).length
    ? describeTaskFactors(item.original as TaskRecord, now).join(' + ')
    : 'ضمن مهام يومك بهدوء';
}
