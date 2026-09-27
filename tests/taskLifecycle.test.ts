// ============================================================
// رِفق — اختبارات دورة حياة المهمة (المصدر الموحّد + القاعدة)
// القاعدة: مهمة مفتوحة مجدولة ⇔ حدث مرن واحد · منجزة/محذوفة ⇔ صفر أحداث
// + إنفاذ القاعدة على البيانات القائمة (idempotent)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  completeTask,
  reopenTask,
  deleteTask,
  updateTask,
  applySchedule,
  enforceTaskEventInvariant,
  onTaskLifecycleChange
} from '../src/core/services/taskLifecycle';
import { taskRepository, calendarRepository } from '../src/core/db/repositories';
import { db } from '../src/core/db/schema';
import type { TaskRecord, CalendarEvent } from '../src/core/types';

async function makeTask(partial: Partial<TaskRecord> = {}): Promise<TaskRecord> {
  return taskRepository.create({
    title: 'مهمة',
    importance: 'low',
    urgency: 'low',
    estimatedDuration: 60,
    status: 'todo',
    ...partial
  } as unknown as Parameters<typeof taskRepository.create>[0]);
}

async function makeEvent(partial: Partial<CalendarEvent>): Promise<CalendarEvent> {
  return calendarRepository.create({
    title: 'حدث',
    kind: 'flexible',
    start: '2026-01-12T10:00:00.000Z',
    end: '2026-01-12T11:00:00.000Z',
    ...partial
  } as unknown as Parameters<typeof calendarRepository.create>[0]);
}

describe('taskLifecycle — مصدر واحد لدورة حياة المهمة', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('الجدولة تنشئ حدثًا مرنًا واحدًا وتستبدل السابق بدل التراكم', async () => {
    const t = await makeTask();
    await applySchedule(t.id, '2026-01-12T10:00:00.000Z');
    await applySchedule(t.id, '2026-01-13T14:00:00.000Z');

    const linked = await calendarRepository.getByLinkedTask(t.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].start).toBe('2026-01-13T14:00:00.000Z');
    expect((await taskRepository.get(t.id))?.scheduledAt).toBe('2026-01-13T14:00:00.000Z');
  });

  it('الإنجاز يحرّر المساحة ويبقي الموعد سجلًا (لا أحداث مرنة — الخيار A)', async () => {
    const t = await makeTask();
    await applySchedule(t.id, '2026-01-12T10:00:00.000Z');
    await completeTask(t.id);

    const task = await taskRepository.get(t.id);
    expect(task?.status).toBe('done');
    expect(task?.scheduledAt).toBe('2026-01-12T10:00:00.000Z');
    expect(await calendarRepository.getByLinkedTask(t.id)).toHaveLength(0);
  });

  it('إعادة الفتح تستعيد حدثًا مرنًا واحدًا بالموعد والمدة نفسيهما', async () => {
    const t = await makeTask({ estimatedDuration: 60 });
    await applySchedule(t.id, '2026-01-12T10:00:00.000Z');
    await completeTask(t.id);
    await reopenTask(t.id);

    expect((await taskRepository.get(t.id))?.status).toBe('todo');
    const linked = await calendarRepository.getByLinkedTask(t.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].start).toBe('2026-01-12T10:00:00.000Z');
    expect(linked[0].end).toBe('2026-01-12T11:00:00.000Z');
  });

  it('الحذف يزيل المهمة وأحداثها المرنة معًا', async () => {
    const t = await makeTask();
    await applySchedule(t.id, '2026-01-12T10:00:00.000Z');
    await deleteTask(t.id);

    expect(await taskRepository.get(t.id)).toBeUndefined();
    expect(await calendarRepository.getByLinkedTask(t.id)).toHaveLength(0);
  });

  it('تعديل العنوان يُحدّث الحدث المربوق ليبقى انعكاسًا أمينًا', async () => {
    const t = await makeTask();
    await applySchedule(t.id, '2026-01-12T10:00:00.000Z');
    await updateTask(t.id, { title: 'عنوان جديد' });

    const linked = await calendarRepository.getByLinkedTask(t.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].title).toBe('عنوان جديد');
    expect(linked[0].start).toBe('2026-01-12T10:00:00.000Z');
  });

  it('دورة الحياة لا تلمس حدثًا غير مربوط (نموذج «حدث جديد»)', async () => {
    const free = await makeEvent({ title: 'محاضرة', kind: 'fixed' });
    const t = await makeTask();
    await applySchedule(t.id, '2026-01-12T10:00:00.000Z');
    await completeTask(t.id);
    await deleteTask(t.id);

    expect(await calendarRepository.get(free.id)).toBeDefined();
  });

  it('الإشعار يُستدعى بعد كل عملية — وبلا إشعار بعد إلغاء الاشتراك', async () => {
    const seen: string[] = [];
    const off = onTaskLifecycleChange(() => seen.push('change'));

    const a = await makeTask();
    await applySchedule(a.id, '2026-01-12T10:00:00.000Z'); // 1
    await completeTask(a.id); // 2
    const b = await makeTask();
    await deleteTask(b.id); // 3

    off();
    const c = await makeTask();
    await completeTask(c.id); // بعد إلغاء الاشتراك — بلا إشعار

    expect(seen).toHaveLength(3);
  });
});


describe('enforceTaskEventInvariant — إنفاذ القاعدة على البيانات القائمة', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('ينظف الأشباح ويبني المفقود ولا يلمس الأحداث غير المربوطة (idempotent)', async () => {
    // شبح من إنجاز قديم (كما كان يحدث عند الإنجاز من شاشة اليوم)
    const doneTask = await makeTask({ status: 'done', scheduledAt: '2026-01-12T10:00:00.000Z' });
    await makeEvent({ linkedTaskId: doneTask.id });
    // حدث يتيم لمهمة حُذفت
    await makeEvent({ linkedTaskId: 'missing-task' });
    // مهمة مفتوحة مجدولة بلا حدث (كما كان يحدث بعد إعادة فتح قديمة)
    const openTask = await makeTask({ scheduledAt: '2026-01-13T09:00:00.000Z' });
    // حدث حر غير مربوط — يجب ألا يُلمس
    const free = await makeEvent({ title: 'حدث حر', kind: 'fixed' });

    const first = await enforceTaskEventInvariant();
    expect(first.removed).toBe(2);
    expect(first.rebuilt).toBe(1);

    expect(await calendarRepository.getByLinkedTask(doneTask.id)).toHaveLength(0);
    expect(await calendarRepository.getByLinkedTask('missing-task')).toHaveLength(0);
    expect(await calendarRepository.getByLinkedTask(openTask.id)).toHaveLength(1);
    expect(await calendarRepository.get(free.id)).toBeDefined();

    // مرة ثانية: لا تغيير (idempotent)
    const again = await enforceTaskEventInvariant();
    expect(again.removed).toBe(0);
    expect(again.rebuilt).toBe(0);
  });

  it('يصلح المكرر والمنحرف عن الموعد إلى حدث واحد مطابق', async () => {
    const t = await makeTask({ scheduledAt: '2026-01-12T10:00:00.000Z' });
    await makeEvent({ linkedTaskId: t.id, start: '2026-01-12T08:00:00.000Z', end: '2026-01-12T08:30:00.000Z' }); // منحرف
    await makeEvent({ linkedTaskId: t.id, start: '2026-01-12T10:00:00.000Z', end: '2026-01-12T11:00:00.000Z' }); // مطابق

    const res = await enforceTaskEventInvariant();
    expect(res.removed).toBe(2);
    expect(res.rebuilt).toBe(1);

    const linked = await calendarRepository.getByLinkedTask(t.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].start).toBe('2026-01-12T10:00:00.000Z');
  });

  it('مهمة منجزة بلا أحداث ومهمة بلا موعد — لا شيء يُبنى لهما', async () => {
    await makeTask({ status: 'done' });
    await makeTask({ title: 'بلا موعد' });

    const res = await enforceTaskEventInvariant();
    expect(res.removed).toBe(0);
    expect(res.rebuilt).toBe(0);
    expect(await calendarRepository.getAll()).toHaveLength(0);
  });
});
