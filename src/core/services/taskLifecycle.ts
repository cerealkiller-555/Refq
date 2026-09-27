// ============================================================
// رِفق — دورة حياة المهمة (المصدر الوحيد للكتابة على المهمة وأحداثها)
// القاعدة (Invariant):
//   • مهمة مفتوحة لها scheduledAt ⇔ بالضبط حدث مرن واحد مربوط بها
//     (يُستعاد عند إعادة الفتح — scheduledAt يبقى سجلًا ولا يُمسح عند الإنجاز).
//   • مهمة منجزة أو محذوفة ⇔ صفر أحداث مرنة (لا أشباح في التقويم أبدًا).
// لا Dexie هنا — كل شيء عبر Repositories. بعد كل عملية يُشعَر
// المسجِّلون (onTaskLifecycleChange) لتحديث متاجر الواجهة من أي شاشة.
// ============================================================

import { taskRepository, calendarRepository } from '../db/repositories';
import type { TaskRecord, CalendarEvent } from '../types';

// ===== إشعار التغيير (يمنع circular imports بين المتاجر) =====

type LifecycleListener = () => void;
const listeners = new Set<LifecycleListener>();

/**
 * الاشراك بتغيّرات دورة حياة المهمة (إنجاز/حذف/إعادة فتح/تعديل/جدولة).
 * المستجيب مسؤول عن القراءات فقط — لا يكتب بيانات أبدًا (لا حلقة).
 */
export function onTaskLifecycleChange(listener: LifecycleListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // فشل مستجيب واحد لا يكسر عملية الكتابة
    }
  }
}

// ===== العمليات =====

/** طابع زمني صالح للتخزين — البيانات القديمة أو المعدّلة يدويًا قد تكون تالفة */
function validISO(value: string | undefined): value is string {
  if (!value) return false;
  return Number.isFinite(new Date(value).getTime());
}

/** استبدال أحداث المهمة المرنة بحدث واحد مشتق من scheduledAt (حذفها إن لا موعد أو كانت منجزة) */
async function rebuildFlexibleEvent(task: TaskRecord): Promise<void> {
  // موعد تالف: لا نبني حدثًا ولا نلمس الموجود (لا حذف أعمى بسبب سجل تالف)
  if (task.scheduledAt && !validISO(task.scheduledAt)) return;
  await calendarRepository.deleteFlexibleByLinkedTask(task.id);
  if (!task.scheduledAt || task.status === 'done') return;
  const start = task.scheduledAt;
  const end = new Date(new Date(start).getTime() + (task.estimatedDuration || 30) * 60000).toISOString();
  await calendarRepository.create({
    title: task.title,
    kind: 'flexible',
    start,
    end,
    linkedTaskId: task.id
  } as unknown as CalendarEvent);
}

/** إتمام مهمة — والمساحة تتحرر: أحداثها المرنة تُحذف (والموعد يبقى سجلًا) */
export async function completeTask(id: string): Promise<void> {
  await taskRepository.markDone(id);
  await calendarRepository.deleteFlexibleByLinkedTask(id);
  notify();
}

/** إعادة فتح مهمة — يُعاد بناء حدثها المرن من scheduledAt إن وجد (الخيار A) */
export async function reopenTask(id: string): Promise<void> {
  const task = await taskRepository.update(id, { status: 'todo' });
  if (task) await rebuildFlexibleEvent(task);
  notify();
}

/** حذف مهمة — مع تحرير أحداثها المرنة المربوطة */
export async function deleteTask(id: string): Promise<void> {
  await taskRepository.delete(id);
  await calendarRepository.deleteFlexibleByLinkedTask(id);
  notify();
}

/**
 * تعديل مهمة — وإن تغيّر عنوانها/مداها مع حدث مرتبط يُعاد بناء الحدث
 * ليبقى انعكاسًا أمينًا للمهمة في التقويم.
 */
export async function updateTask(id: string, changes: Partial<TaskRecord>): Promise<void> {
  const task = await taskRepository.update(id, changes);
  if (task && (changes.title !== undefined || changes.estimatedDuration !== undefined)) {
    const linked = await calendarRepository.getByLinkedTask(id);
    if (linked.length > 0) await rebuildFlexibleEvent(task);
  }
  notify();
}

/** جدولة صامتة (بدون إشعار) — تُستهلك ضمن الدفعات */
async function applyScheduleQuiet(taskId: string, startISO: string): Promise<void> {
  const task = await taskRepository.setScheduled(taskId, startISO);
  if (task) await rebuildFlexibleEvent(task);
}

/** جدولة/إعادة جدولة مهمة: ضبط scheduledAt + استبدال الحدث المرن بواحد مشتق */
export async function applySchedule(taskId: string, startISO: string): Promise<void> {
  await applyScheduleQuiet(taskId, startISO);
  notify();
}

/** جدولة دفعة (إعادة التوزيع اللطيفة) — إشعار واحد بعد الكل */
export async function applySchedules(moves: Array<{ taskId: string; startISO: string }>): Promise<void> {
  for (const move of moves) await applyScheduleQuiet(move.taskId, move.startISO);
  if (moves.length > 0) notify();
}

/** نتيجة إنفاذ القاعدة: ما حُذف (أشباح مؤكدة)، ما أُعيد بناؤه، وما تُرك بلا دليل */
export interface InvariantResult {
  removed: number;
  rebuilt: number;
  skipped: number;
}

/**
 * إنفاذ القاعدة على البيانات القائمة (idempotent — يُستدعى **مرّة واحدة في الجلسة**):
 *   1) حدث مرن مربوط بمهمة **منجزة أو بلا موعد** (شبح مؤكد) ← يُحذف.
 *   2) مهمة **مفتوحة مجدولة** بلا حدث أو بحدث لا يطابق موعدها ← يُعاد بناؤه.
 * لا يُلمس أبدًا (تُحسب skipped):
 *   • حدث مربوط بمعرّف لا يشير إلى مهمة (قد يكون بيانات legacy سليمة — لا دليل على أنه شبح).
 *   • مهمة موعدها تالف (لا نبني ولا نحذف — لا إصلاح أعمى).
 *   • الأحداث المرنة غير المربوطة (من نموذج «حدث جديد»).
 */
export async function enforceTaskEventInvariant(): Promise<InvariantResult> {
  const linkedEvents = (await calendarRepository.getFlexible()).filter((e) => !!e.linkedTaskId);
  const tasks = await taskRepository.getAll();
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const groups = new Map<string, CalendarEvent[]>();
  for (const ev of linkedEvents) {
    const key = ev.linkedTaskId as string;
    const list = groups.get(key);
    if (list) list.push(ev);
    else groups.set(key, [ev]);
  }

  let removed = 0;
  let rebuilt = 0;
  let skipped = 0;

  // 1) كل مجموعة أحداث مربوطة تُدقَّق ضد مهمتها
  for (const [taskId, list] of groups) {
    const task = byId.get(taskId);

    // (1أ) معرّف لا يشير إلى مهمة ⇒ يُترك (لا دليل على أنه شبح)
    if (!task) {
      skipped += list.length;
      continue;
    }

    // (1ب) منجزة أو بلا موعد ⇒ شبح مؤكد ⇒ يُحذف
    if (task.status === 'done' || !task.scheduledAt) {
      await calendarRepository.deleteFlexibleByLinkedTask(taskId);
      removed += list.length;
      continue;
    }

    // (1ج) موعد تالف ⇒ يُترك كما هو (لا نبني ولا نحذف)
    if (!validISO(task.scheduledAt)) {
      skipped += list.length;
      continue;
    }

    const exact = list.filter((e) => e.start === task.scheduledAt);
    if (exact.length !== 1 || list.length !== 1) {
      // مكرر أو انحراف عن الموعد ← إعادة بناء نظيفة واحدة
      await rebuildFlexibleEvent(task);
      removed += list.length;
      rebuilt += 1;
    }
  }

  // 2) مهمة مفتوحة مجدولة (موعدها صالح) بلا أي حدث ← يُبنى لها حدثها
  for (const task of tasks) {
    if (task.status === 'done' || !task.scheduledAt) continue;
    if (!validISO(task.scheduledAt)) continue;
    if (!groups.has(task.id)) {
      await rebuildFlexibleEvent(task);
      rebuilt += 1;
    }
  }

  return { removed, rebuilt, skipped };
}
