// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات واجهة التخطيط/التقويم (P2)
// 1) إضافة حدث من تبويب اليوم ثم ظهوره
// 2) شبكة الأسبوع تعرض أعمدة الأيام
// 3) الأحداث الثابتة بشارة الثابت + عرض الشهر/الأسبوع بلا توهان
// (اختبارات المهام انتقلت إلى myplan.test.tsx مع لوحة TasksPanel)
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanningPage } from '../../src/ui/screens/planning/PlanningPage';
import { usePlanningStore } from '../../src/core/store/usePlanningStore';
import { taskRepository } from '../../src/core/db/repositories';
import { db } from '../../src/core/db/schema';
import { localDateTimeISO, todayKey } from '../../src/core/engines/calendarEngine';
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
  it('عرض الشهر: شبكة 42 يومًا مع عدّاد المهام المجدولة، والضغط على يوم يفتحه', async () => {
    const user = userEvent.setup();
    await makeTask({ title: 'مهمة الشهر', scheduledAt: localDateTimeISO(todayKey(), '11:00') });
    await usePlanningStore.getState().load();

    render(<PlanningPage />);
    await user.click(await screen.findByRole('tab', { name: cal.tabs.month }));

    await waitFor(() => {
      expect(document.querySelector('.month-grid')).not.toBeNull();
    });
    expect(document.querySelectorAll('.month-cell')).toHaveLength(42);
    // يوم اليوم يحمل عدّاد مهمة واحدة
    expect(document.querySelector('.mb-task')?.textContent).toContain('📋');

    // الضغط على اليوم الحالي يفتح عرض اليوم بتفاصيله
    await user.click(document.querySelector('.month-cell.today') as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('مهمة الشهر')).toBeDefined();
    });
  });

  it('عرض الأسبوع يعرض المهام المجدولة مع الأحداث بلا توهان', async () => {
    const user = userEvent.setup();
    await makeTask({ title: 'مهمة الأسبوع', scheduledAt: localDateTimeISO(todayKey(), '15:00') });
    await usePlanningStore.getState().addOccurrence({
      title: 'حدث الأسبوع',
      kind: 'fixed',
      dateKey: todayKey(),
      time: '08:00',
      durationMinutes: 60
    });
    await usePlanningStore.getState().load();

    render(<PlanningPage />);
    await user.click(await screen.findByRole('tab', { name: cal.tabs.week }));

    await waitFor(() => {
      expect(document.querySelector('.week-grid')).not.toBeNull();
    });
    expect(document.querySelectorAll('.week-col')).toHaveLength(7);
    expect(document.querySelectorAll('.task-chip').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('مهمة الأسبوع').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('حدث الأسبوع').length).toBeGreaterThanOrEqual(1);
  });
});