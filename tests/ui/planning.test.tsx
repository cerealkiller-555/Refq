// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات واجهة التخطيط/التقويم (P2)
// 1) إضافة حدث من تبويب اليوم ثم ظهوره
// 2) شبكة الأسبوع تعرض أعمدة الأيام
// 3) جدولة مهمة من الـUI تُنشئ حدثًا مربوطًا
// 4) لافتة اليوم الفائت تظهر للمتأخرات وتختفي بعد إعادة التوزيع
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanningPage } from '../../src/ui/screens/planning/PlanningPage';
import { usePlanningStore } from '../../src/core/store/usePlanningStore';
import { taskRepository, calendarRepository } from '../../src/core/db/repositories';
import { db } from '../../src/core/db/schema';
import { localDateTimeISO, todayKey, addDaysKey } from '../../src/core/engines/calendarEngine';
import type { TaskRecord } from '../../src/core/types';
import { voice } from '../../src/i18n/voice';

const cal = voice.planning.calendar;

beforeEach(async () => {
  await db.delete();
  await db.open();
  usePlanningStore.setState({ tasks: [], events: [], replanResult: null });
});

afterEach(() => cleanup());

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

describe('Planning Calendar UI', () => {
  it('إضافة حدث من تبويب اليوم ثم ظهوره في القائمة', async () => {
    const user = userEvent.setup();
    render(<PlanningPage />);

    // نفتح تبويب اليوم
    await user.click(await screen.findByRole('tab', { name: cal.tabs.day }));

    // نكشف النموذج ونملأه
    await user.click(await screen.findByRole('button', { name: `+ ${cal.addEventTitle}` }));
    await user.type(await screen.findByPlaceholderText(cal.eventName), 'محاضرة التفسير');
    await user.click(screen.getByRole('button', { name: cal.save }));

    await waitFor(() => {
      expect(screen.getAllByText('محاضرة التفسير').length).toBeGreaterThanOrEqual(1);
    });
    // مصنف كثابت في القائمة
    expect(screen.getByText(cal.kindLabels.fixed)).toBeDefined();
  });

  it('شبكة الأسبوع تعرض أعمدة الأيام السبعة بعد إضافة حدث', async () => {
    const user = userEvent.setup();
    await usePlanningStore.getState().addOccurrence({
      title: 'مراجعة',
      kind: 'flexible',
      dateKey: todayKey(),
      time: '10:00',
      durationMinutes: 45
    });

    render(<PlanningPage />);
    await user.click(await screen.findByRole('tab', { name: cal.tabs.week }));

    await waitFor(() => {
      expect(document.querySelector('.week-grid')).not.toBeNull();
    });
    expect(document.querySelectorAll('.week-col')).toHaveLength(7);
    expect(screen.getAllByText('مراجعة').length).toBeGreaterThanOrEqual(1);
  });

  it('جدولة مهمة من الـUI تنشئ حدثًا مربوطًا', async () => {
    const user = userEvent.setup();
    const task = await makeTask({ title: 'حل واجب الفيزياء' });
    await usePlanningStore.getState().load();

    render(<PlanningPage />);
    const scheduleBtn = await screen.findByRole('button', { name: cal.schedule.button });
    await user.click(scheduleBtn);

    const dateInput = (await screen.findByLabelText(cal.schedule.date)) as HTMLInputElement;
    const timeInput = screen.getByLabelText(cal.schedule.time) as HTMLInputElement;
    const target = addDaysKey(todayKey(), 1);

    // jsdom لا يدعم فتح المنتقي — نستخدم fireEvent لتفعيل onChange في React
    fireEvent.change(dateInput, { target: { value: target } });
    fireEvent.change(timeInput, { target: { value: '09:30' } });

    await user.click(screen.getByRole('button', { name: cal.schedule.confirm }));

    await waitFor(async () => {
      const linked = await calendarRepository.getByLinkedTask(task.id);
      expect(linked).toHaveLength(1);
      expect(linked[0].kind).toBe('flexible');
      expect(linked[0].start).toBe(localDateTimeISO(target, '09:30'));
    });
    const updated = await taskRepository.get(task.id);
    expect(updated?.scheduledAt).toBe(localDateTimeISO(target, '09:30'));
  });

  it('لافتة اليوم الفائت تظهر للمتأخرات وتختفي بعد إعادة التوزيع اللطيفة', async () => {
    const user = userEvent.setup();
    const overdueTask = await makeTask({
      title: 'مراجعة متأخرة',
      scheduledAt: localDateTimeISO(addDaysKey(todayKey(), -2), '09:00')
    });
    await usePlanningStore.getState().load();

    render(<PlanningPage />);

    // اللافتة تظهر برسالة لطيفة بلا لوم
    expect(await screen.findByText(cal.recovery.banner)).toBeDefined();

    // الضغط على الزر ينفذ إعادة التوزيع — المهمة تتقرر في يوم قادم
    await user.click(screen.getByRole('button', { name: cal.recovery.button }));

    await waitFor(() => {
      expect(usePlanningStore.getState().replanResult).not.toBeNull();
    });
    const updated = await taskRepository.get(overdueTask.id);
    const sched = updated?.scheduledAt;
    expect(sched).toBeTruthy();
    expect(sched!.slice(0, 10) >= todayKey()).toBe(true);

    // رسالة النجاح اللطيفة ظهرت واللافتة الأصلية اختفت
    expect(screen.getByText(cal.recovery.applied)).toBeDefined();
    expect(screen.queryByText(cal.recovery.banner)).toBeNull();
  });

  it('الأحداث الثابتة تُعرض بشارة الثابت في عرض اليوم', async () => {
    const user = userEvent.setup();
    await usePlanningStore.getState().addOccurrence({
      title: 'درس ثابت مهم',
      kind: 'fixed',
      dateKey: todayKey(),
      time: '08:00',
      durationMinutes: 60
    });

    render(<PlanningPage />);
    await user.click(await screen.findByRole('tab', { name: cal.tabs.day }));

    const list = await screen.findByRole('list');
    const row = within(list).getByText('درس ثابت مهم').closest('li');
    expect(row?.className).toContain('ev-fixed');
  });
});