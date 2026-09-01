// ============================================================
// رِفق — اختبارات Planning Store (P2)
// جدولة المهام كأحداث مربوطة + تحرير المساحة عند الإنجاز
// + إعادة التوزيع اللطيفة — الثوابت لا تُلمس أبدًا
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { usePlanningStore } from '../src/core/store/usePlanningStore';
import { taskRepository, calendarRepository } from '../src/core/db/repositories';
import { db } from '../src/core/db/schema';
import { eventsForDay } from '../src/core/engines/calendarEngine';
import type { TaskRecord } from '../src/core/types';

describe('Planning Store P2', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    usePlanningStore.setState({ tasks: [], events: [], replanResult: null });
  });

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

  it('scheduleTask ينشئ حدثًا مرنًا مربوطًا ويضبط scheduledAt (وياخذ المدة من المهمة)', async () => {
    const task = await makeTask({ estimatedDuration: 45 });
    await usePlanningStore.getState().scheduleTask(task.id, '2026-01-12', '10:00');

    const linked = await calendarRepository.getByLinkedTask(task.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].kind).toBe('flexible');
    expect(linked[0].title).toBe(task.title);

    const start = new Date(linked[0].start);
    const end = new Date(linked[0].end);
    expect(start.getHours()).toBe(10);
    expect((end.getTime() - start.getTime()) / 60000).toBe(45);

    const updated = await taskRepository.get(task.id);
    expect(updated?.scheduledAt).toBe(linked[0].start);
  });

  it('إعادة الجدولة تستبدل الحدث السابق بدل التراكم', async () => {
    const task = await makeTask();
    await usePlanningStore.getState().scheduleTask(task.id, '2026-01-12', '10:00');
    await usePlanningStore.getState().scheduleTask(task.id, '2026-01-13', '14:00');

    const linked = await calendarRepository.getByLinkedTask(task.id);
    expect(linked).toHaveLength(1);
    expect(new Date(linked[0].start).getDate()).toBe(13);
  });

  it('إنجاز المهمة يحرر المساحة: أحداثها المرنة تُحذف والثوابت تبقى', async () => {
    const task = await makeTask();
    await usePlanningStore.getState().scheduleTask(task.id, '2026-01-12', '10:00');
    const fixed = await calendarRepository.create({
      title: 'درس ثابت',
      kind: 'fixed',
      start: '2026-01-12T08:00:00.000Z',
      end: '2026-01-12T09:00:00.000Z'
    } as Parameters<typeof calendarRepository.create>[0]);

    await usePlanningStore.getState().markTaskDone(task.id);

    expect(await calendarRepository.getByLinkedTask(task.id)).toHaveLength(0);
    expect(await calendarRepository.get(fixed.id)).toBeDefined();
    expect((await taskRepository.get(task.id))?.status).toBe('done');
  });

  it('حذف المهمة يحذف أحداثها المرنة المربوطة', async () => {
    const task = await makeTask();
    await usePlanningStore.getState().scheduleTask(task.id, '2026-01-12', '10:00');

    await usePlanningStore.getState().deleteTask(task.id);

    expect(await taskRepository.get(task.id)).toBeUndefined();
    expect(await calendarRepository.getByLinkedTask(task.id)).toHaveLength(0);
  });

  it('replan يوزع المهام على أيام قادمة وينشئ أحداثًا مرنة مربوطة — والثابت لا يتحرك', async () => {
    // ثابت أسبوعي كل يوم اثنين — يخصم من سعة يومه فقط
    await calendarRepository.create({
      title: 'سيشن ثابت',
      kind: 'fixed',
      start: '2026-01-12T09:00:00.000Z',
      end: '2026-01-12T11:00:00.000Z'
    } as Parameters<typeof calendarRepository.create>[0]);

    const t1 = await makeTask({ estimatedDuration: 120 });
    const t2 = await makeTask({ estimatedDuration: 300 });

    const plan = await usePlanningStore.getState().replan();

    expect(plan.moved).toHaveLength(2);
    // كل يوم توزيع بعد اليوم الحالي — والثابت لا يظهر في moved أبدًا
    expect(plan.moved.every((m) => m.taskId !== 'fixed-event')).toBe(true);
    const days = plan.moved.map((m) => m.scheduledAt.slice(0, 10));
    expect(days.every((d) => d >= new Date().toISOString().slice(0, 10))).toBe(true);

    // كل مهمة متحركة أصبح لها حدث مرن مربوط بها في التقويم
    for (const t of [t1, t2]) {
      const linked = await calendarRepository.getByLinkedTask(t.id);
      expect(linked).toHaveLength(1);
      expect(linked[0].kind).toBe('flexible');
    }

    // الأحداث في التقويم تشمل الثابت + المرنين
    const all = await calendarRepository.getAll();
    expect(all.filter((e) => e.kind === 'fixed')).toHaveLength(1);
    expect(all.filter((e) => e.kind === 'flexible')).toHaveLength(2);

    // store حالة الـUI: النتيجة محفوظة للعرض اللطيف
    expect(usePlanningStore.getState().replanResult?.message).toContain('لا بأس');
  });

  it('addOccurrence ينشئ حدثًا من تاريخ/وقت محلي ويظهر في eventsForDay', async () => {
    await usePlanningStore.getState().addOccurrence({
      title: 'مراجعة سريعة',
      kind: 'flexible',
      dateKey: '2026-01-12',
      time: '18:30',
      durationMinutes: 30
    });

    const events = usePlanningStore.getState().events;
    expect(events).toHaveLength(1);
    const day = eventsForDay(events, '2026-01-12');
    expect(day).toHaveLength(1);
    expect(day[0].event.title).toBe('مراجعة سريعة');
  });
});