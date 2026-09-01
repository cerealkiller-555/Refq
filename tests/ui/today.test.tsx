// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات واجهة اليوم (P1)
// 1) إضافة مهمة من الالتقاط السريع ثم ظهورها
// 2) تسجيل الطاقة يُحفظ ويبقى بعد refresh
// 3) "ماذا أفعل الآن؟" يقترح المهمة المناسبة فقط
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodayPage } from '../../src/ui/screens/today/TodayPage';
import { useTodayStore } from '../../src/core/store/useTodayStore';
import { taskRepository } from '../../src/core/db/repositories';
import { db } from '../../src/core/db/schema';
import type { TaskRecord } from '../../src/core/types';
import { voice } from '../../src/i18n/voice';

const initialTodayState = {
  tasks: [] as TaskRecord[],
  todayEnergy: null,
  lightDay: false,
  topPriorities: [] as TaskRecord[],
  suggestion: null,
  loaded: false
};

beforeEach(async () => {
  await db.delete();
  await db.open();
  useTodayStore.setState(initialTodayState);
});

afterEach(() => cleanup());

describe('TodayPage UI', () => {
  it('إضافة مهمة من الالتقاط السريع ثم ظهورها في القائمة', async () => {
    const user = userEvent.setup();
    render(<TodayPage />);

    const input = await screen.findByPlaceholderText(voice.today.quickCapture.placeholder);
    await user.type(input, 'مراجعة ورد القرآن{Enter}');

    // المهمة تظهر في القائمة (ولعله في الأولويات أيضًا)
    const matches = await screen.findAllByText('مراجعة ورد القرآن');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('تسجيل الطاقة يُحفظ ويبقى بعد إعادة التحميل (refresh)', async () => {
    const user = userEvent.setup();
    render(<TodayPage />);

    const highBtn = await screen.findByRole('button', { name: /عالية/ });
    await user.click(highBtn);

    await waitFor(() => expect(useTodayStore.getState().todayEnergy).toBe('high'));

    // محاكاة refresh: مسح حالة الذاكرة ثم إعادة القراءة من قاعدة البيانات فقط
    useTodayStore.setState({ todayEnergy: null, lightDay: false });
    await useTodayStore.getState().loadToday();

    expect(useTodayStore.getState().todayEnergy).toBe('high');
    expect(useTodayStore.getState().lightDay).toBe(false);
  });

  it('"ماذا أفعل الآن؟" يقترح المهمة المناسبة فقط (30 دقيقة)', async () => {
    await taskRepository.create({
      title: 'مراجعة الفصل الثاني',
      importance: 'high',
      urgency: 'high',
      estimatedDuration: 30,
      status: 'todo'
    } as Parameters<typeof taskRepository.create>[0]);
    await taskRepository.create({
      title: 'مهمة طويلة لا تناسب الآن',
      importance: 'low',
      urgency: 'low',
      estimatedDuration: 90,
      status: 'todo'
    } as Parameters<typeof taskRepository.create>[0]);

    const user = userEvent.setup();
    render(<TodayPage />);

    const btn30 = await screen.findByRole('button', { name: '30 دقيقة' });
    await user.click(btn30);

    await waitFor(() => {
      const suggestion = useTodayStore.getState().suggestion;
      expect(suggestion?.task?.title).toBe('مراجعة الفصل الثاني');
    });

    const matches = await screen.findAllByText('مراجعة الفصل الثاني');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});