// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات واجهة اليوم (P1) + حدود الفترة (P3)
// 1) إضافة مهمة من الالتقاط السريع ثم ظهورها
// 2) تسجيل الطاقة يُحفظ ويبقى بعد refresh
// 3) "ماذا أفعل الآن؟" يقترح المهمة المناسبة فقط
// 4) فترات اليوم: لافتة بين الصلوات + أزرار المدة المعطّلة
// 5) fallback عند فشل الجلب (آخر محفوظة / بلا مراسٍ يعمل كالعادة)
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodayPage } from '../../src/ui/screens/today/TodayPage';
import { useTodayStore } from '../../src/core/store/useTodayStore';
import { taskRepository, calendarRepository, prayerAnchorRepository } from '../../src/core/db/repositories';
import { db } from '../../src/core/db/schema';
import type { TaskRecord, PrayerAnchor } from '../../src/core/types';
import { voice } from '../../src/i18n/voice';
import { localDateKey } from '../../src/utils';
import { getCurrentPeriod } from '../../src/core/engines/dayPeriods';
import { localDateTimeISO } from '../../src/core/engines/calendarEngine';
import { applySchedule } from '../../src/core/services/taskLifecycle';

const initialTodayState = {
  tasks: [] as TaskRecord[],
  todayEnergy: null,
  lightDay: false,
  topPriorities: [] as TaskRecord[],
  suggestion: null,
  anchors: [] as PrayerAnchor[],
  currentPeriod: null,
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
    act(() => {
      useTodayStore.setState({ todayEnergy: null, lightDay: false });
    });
    await act(async () => {
      await useTodayStore.getState().loadToday();
    });

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

describe('TodayPage — فترات الصلاة (P3)', () => {
  it('عرض لافتة الفترة + أزرار 45 و60 معطّلة عند المتبقي 35 دقيقة', async () => {
    // مراسٍ محفوظة اليوم: العصر انتهى والمغرب يأتي بعد 35 دقيقة + هامش ثوانٍ آمن (الـloadToday يُبقي عليها)
    const now = new Date();
    const day = localDateKey();
    const seeded = await prayerAnchorRepository.replaceForDate(day, [
      { date: day, prayer: 'fajr', time: new Date(now.getTime() - 13 * 3600000).toISOString(), source: 'service' },
      { date: day, prayer: 'dhuhr', time: new Date(now.getTime() - 6 * 3600000).toISOString(), source: 'service' },
      { date: day, prayer: 'asr', time: new Date(now.getTime() - 3600000).toISOString(), source: 'service' },
      { date: day, prayer: 'maghrib', time: new Date(now.getTime() + 35 * 60000 + 45000).toISOString(), source: 'service' },
      { date: day, prayer: 'isha', time: new Date(now.getTime() + 3 * 3600000).toISOString(), source: 'service' }
    ]);

    // نطبع المراسي في الـstore ونحسب الفترة الآن — والـloadToday سيبقى عليها (fallback محفوظ)
    const current = getCurrentPeriod(seeded, new Date().toISOString());
    useTodayStore.setState({
      anchors: seeded,
      currentPeriod: current,
      loaded: true
    });

    render(<TodayPage />);

    // اللافتة تعرض "بين العصر والمغرب" والمتبقي
    expect(await screen.findByText(/بين العصر والمغرب/)).toBeDefined();
    expect(screen.getByText(/المغرب بعد 35 دقيقة/)).toBeDefined();

    // الأزرار: 15 و30 متاحة، 45 و60 معطّلة (مقيدة بالمرساة)
    expect((screen.getByRole('button', { name: '15 دقيقة' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: '30 دقيقة' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: '45 دقيقة' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '60 دقيقة' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ليل مفتوح: كل أزرار المدة متاحة', async () => {
    // مرساة واحدة اليوم قد انتهت الآن → ليل مفتوح بلا سقف عملي
    const now = new Date();
    const day = localDateKey();
    const seeded = await prayerAnchorRepository.replaceForDate(day, [
      { date: day, prayer: 'isha', time: new Date(now.getTime() - 5 * 60000).toISOString(), source: 'service' }
    ]);
    const current = getCurrentPeriod(seeded, new Date().toISOString());
    useTodayStore.setState({ anchors: seeded, currentPeriod: current, loaded: true });

    render(<TodayPage />);

    // لافتة الفترة (role=status) — نصها الدقيق من i18n لا يتعارض مع تحية «ليلة طيبة»
    // التي تظهر في <h2> أثناء ساعات الليل (منع أي تكرار نص ليلي)
    const banner = await screen.findByRole('status');
    expect(within(banner).getByText(voice.today.period.nightOpen)).toBeDefined();

    expect((screen.getByRole('button', { name: '45 دقيقة' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: '60 دقيقة' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('بلا مراسٍ: Today يعمل كالعادة وكل الأزرار متاحة', async () => {
    useTodayStore.setState({ anchors: [], currentPeriod: null, loaded: true });
    render(<TodayPage />);

    // لا لافتة فترة
    expect(screen.queryByText(/بين العصر/)).toBeNull();
    expect((screen.getByRole('button', { name: '60 دقيقة' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('fallback: عند فشل الجلب يُحمَّل آخر مراسٍ محفوظة لليوم ويُحسب منها', async () => {
    // محفوظة سابقًا لليوم (source:service) في Dexie
    const now = new Date();
    const day = localDateKey();
    const seeded = await prayerAnchorRepository.replaceForDate(day, [
      { date: day, prayer: 'fajr', time: new Date(now.getTime() - 14 * 3600000).toISOString(), source: 'service' },
      { date: day, prayer: 'dhuhr', time: new Date(now.getTime() - 7 * 3600000).toISOString(), source: 'service' },
      { date: day, prayer: 'asr', time: new Date(now.getTime() - 3600000).toISOString(), source: 'service' },
      { date: day, prayer: 'maghrib', time: new Date(now.getTime() + 25 * 60000).toISOString(), source: 'service' },
      { date: day, prayer: 'isha', time: new Date(now.getTime() + 3 * 3600000).toISOString(), source: 'service' }
    ]);

    // نقرأ المحفوظة ونحسب الفترة (محاكاة إعادة التحميل بعد فشل الجلب)
    const anchors = await prayerAnchorRepository.getForDate(day);
    const current = getCurrentPeriod(anchors, new Date().toISOString());
    useTodayStore.setState({ anchors, currentPeriod: current, loaded: true });

    render(<TodayPage />);
    expect(await screen.findByText(/بين العصر والمغرب/)).toBeDefined();
    // persistence: القراءة من Dexie نجحت — نفس المحتوى المحفوظ تمامًا (مستقل عن ترتيب القراءة)
    expect(anchors).toHaveLength(5);
    expect(anchors.map((a) => a.prayer).sort()).toEqual(seeded.map((a) => a.prayer).sort());
    expect(anchors.map((a) => a.id).sort()).toEqual(seeded.map((a) => a.id).sort());
    // ننتظر اكتمال دورة التحميل التلقائي داخل act — كي لا تبقى دوارات معلقة بعد نهاية الاختبار
    await waitFor(() => {
      expect(useTodayStore.getState().currentPeriod?.period.anchor).toBe('asr');
    });
  });
});

describe('Today — إنجاز المهمة يحرّر أحداثها (مسار دورة الحياة الموحّد)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    useTodayStore.setState(initialTodayState);
  });

  afterEach(() => cleanup());

  it('إنجاز مهمة مجدولة من شاشة اليوم يزيل حدثها المرن من التقويم', async () => {
    const task = await taskRepository.create({
      title: 'مهمة مجدولة اليوم',
      importance: 'low',
      urgency: 'low',
      estimatedDuration: 30,
      status: 'todo'
    } as Parameters<typeof taskRepository.create>[0]);
    await applySchedule(task.id, localDateTimeISO(localDateKey(), '10:00'));
    expect(await calendarRepository.getByLinkedTask(task.id)).toHaveLength(1);

    render(<TodayPage />);

    // العنوان قد يظهر في «أهم الأولويات» و«مهام اليوم» — نضغط إنجاز على أول صف
    const rows = await screen.findAllByText('مهمة مجدولة اليوم');
    const row = rows[0].closest('li') as HTMLElement;
    await userEvent.click(within(row).getByLabelText(voice.common.complete));

    await waitFor(async () => {
      expect(await calendarRepository.getByLinkedTask(task.id)).toHaveLength(0);
    });
    expect((await taskRepository.get(task.id))?.status).toBe('done');
  });
});
