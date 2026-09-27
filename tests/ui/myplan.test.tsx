// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات واجهة خطتي (MyPlanPage)
// 1) عرض حالة الفراغ عندما لا توجد مسارات
// 2) عرض المواد مع نسبة الإنجاز وحساب "أين توقفتِ؟" والخطوة القادمة
// 3) إطلاق جلسة دراسية يفعّل ActiveTaskBar وuseActiveTaskStore
// 4) توسيع وطي قائمة الخطوات للمادة
// 5) تبويب المهام (?tab=tasks): اللمحة، الجدولة، لافتة اليوم الفائت
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MyPlanPage } from '../../src/ui/screens/myplan/MyPlanPage';
import { useLearningStore } from '../../src/core/store/useLearningStore';
import { useActiveTaskStore } from '../../src/core/store/useActiveTaskStore';
import { usePlanningStore } from '../../src/core/store/usePlanningStore';
import { db } from '../../src/core/db/schema';
import {
  learningPathRepository,
  pathItemRepository,
  sessionRepository,
  taskRepository,
  calendarRepository
} from '../../src/core/db/repositories';
import { localDateTimeISO, todayKey, addDaysKey, dateKey } from '../../src/core/engines/calendarEngine';
import { voice } from '../../src/i18n/voice';
import type { LearningPath, PathItem, TaskRecord } from '../../src/core/types';

const M = voice.myPlan;
const cal = voice.planning.calendar;

const ts = { createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' };

function makePath(over: Partial<LearningPath> = {}): LearningPath {
  return {
    id: over.id ?? `path-${Math.random().toString(36).slice(2, 8)}`,
    title: over.title ?? 'مادة أصول الفقه',
    type: over.type ?? 'university',
    status: over.status ?? 'active',
    order: over.order ?? 0,
    ...ts,
    ...over
  };
}

function makeItem(over: Partial<PathItem> & { pathId: string }): PathItem {
  return {
    id: over.id ?? `item-${Math.random().toString(36).slice(2, 8)}`,
    title: over.title ?? 'المحاضرة الأولى',
    order: over.order ?? 0,
    status: over.status ?? 'todo',
    estimatedDuration: over.estimatedDuration ?? 30,
    ...ts,
    ...over
  };
}

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

/** MyPlanPage يستخدم useSearchParams — لازم MemoryRouter */
function renderAt(entry = '/myplan') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MyPlanPage />
    </MemoryRouter>
  );
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
  useActiveTaskStore.setState({ active: null, timer: null });
  usePlanningStore.setState({ tasks: [], events: [], replanResult: null });
});

afterEach(() => cleanup());

describe('MyPlanPage UI — خطتي', () => {
  it('يعرض رسالة الفراغ الهادئة عند عدم وجود أي مسارات', async () => {
    renderAt();
    expect(await screen.findByText(M.empty)).toBeDefined();
    expect(screen.getByText(M.title)).toBeDefined();
  });

  it('يعرض بطاقة المادة مع نسبة الإنجاز والخطوة القادمة وآخر توقف', async () => {
    const p = await learningPathRepository.create(makePath({ title: 'تفسير جزء عم' }));
    const it1 = await pathItemRepository.create(makeItem({ pathId: p.id, title: 'سورة النبأ', order: 0, status: 'done' }));
    await pathItemRepository.create(makeItem({ pathId: p.id, title: 'سورة النازعات', order: 1, status: 'todo', estimatedDuration: 25 }));

    // تسجيل جلسة على سورة النبأ لتظهر كآخر توقف
    await sessionRepository.create({
      pathItemId: it1.id,
      date: new Date().toISOString(),
      durationMinutes: 20,
      ...ts
    });

    renderAt();

    expect(await screen.findByText('تفسير جزء عم')).toBeDefined();
    // نسبة الإنجاز: 1 من 2 (50%)
    expect(screen.getByText(/أُنجز 1 من 2/)).toBeDefined();
    // آخر توقف
    expect(screen.getByText(/«سورة النبأ»/)).toBeDefined();
    // الخطوة التالية
    expect(screen.getByText('سورة النازعات')).toBeDefined();
    expect(screen.getByText('25 د')).toBeDefined();
  });

  it('الضغط على «ابدئي جلسة» يطلق الجلسة في useActiveTaskStore', async () => {
    const user = userEvent.setup();
    const p = await learningPathRepository.create(makePath({ title: 'نظم المعلومات' }));
    await pathItemRepository.create(makeItem({ pathId: p.id, title: 'الفصل الأول', order: 0, status: 'todo', estimatedDuration: 40 }));

    renderAt();

    // انتظر تحميل المسار أولًا (load() في useEffect أبطأ من مهلة findByRole الافتراضية)
    expect(await screen.findByText('نظم المعلومات', {}, { timeout: 5000 })).toBeDefined();
    const startBtn = await screen.findByRole('button', { name: /ابدئي جلسة/ }, { timeout: 5000 });
    await user.click(startBtn);

    await waitFor(() => {
      const active = useActiveTaskStore.getState().active;
      expect(active).not.toBeNull();
      expect(active?.title).toBe('الفصل الأول');
      expect(active?.kind).toBe('learning');
      expect(useActiveTaskStore.getState().timer?.plannedMinutes).toBe(40);
    });

    // بعد البدء تظهر علامة "شغّالة عليها الآن" أو "مستمرة الآن"
    expect(await screen.findByText(M.inProgressIndicator)).toBeDefined();
  });

  it('توسيع وطي خطوات المادة', async () => {
    const user = userEvent.setup();
    const p = await learningPathRepository.create(makePath({ title: 'برمجة الويب' }));
    await pathItemRepository.create(makeItem({ pathId: p.id, title: 'مقدمة HTML', order: 0, status: 'done' }));
    await pathItemRepository.create(makeItem({ pathId: p.id, title: 'أساسيات CSS', order: 1, status: 'todo' }));

    renderAt();

    const toggleBtn = await screen.findByRole('button', { name: /عرض كل الخطوات/ });
    await user.click(toggleBtn);

    expect(await screen.findByRole('list', { name: 'برمجة الويب' })).toBeDefined();
    expect(screen.getByText('مقدمة HTML')).toBeDefined();
    expect(screen.getAllByText('أساسيات CSS').length).toBeGreaterThanOrEqual(1);

    // النقر مرة أخرى للطي
    await user.click(screen.getByRole('button', { name: /طي الخطوات/ }));
    expect(screen.queryByRole('list', { name: 'برمجة الويب' })).toBeNull();
  });
});

describe('MyPlanPage UI — تبويب المهام', () => {
  it('التبديل إلى «📋 المهام» يعرض لوحة المهام والعودة تُخفيها', async () => {
    const user = userEvent.setup();
    renderAt();

    await user.click(await screen.findByRole('tab', { name: M.tabs.tasks }));
    // لوحة المهام ظهرت — نموذج إضافة سطر واحد
    expect(await screen.findByPlaceholderText(voice.planning.quickAddPlaceholder)).toBeDefined();
    expect(screen.getByRole('tab', { name: M.tabs.tasks }).getAttribute('aria-selected')).toBe('true');

    // العودة إلى خطتي
    await user.click(screen.getByRole('tab', { name: M.tabs.plan }));
    expect(screen.queryByPlaceholderText(voice.planning.quickAddPlaceholder)).toBeNull();
  });

  it('فتح الرابط مباشرة بـ ?tab=tasks يعرض لوحة المهام', async () => {
    renderAt('/myplan?tab=tasks');
    expect(await screen.findByText(/مهمة مفتوحة/)).toBeDefined();
    expect(screen.getByRole('tab', { name: M.tabs.tasks }).getAttribute('aria-selected')).toBe('true');
  });

  it('جدولة مهمة من لوحة المهام تنشئ حدثًا مربوطًا', async () => {
    const user = userEvent.setup();
    const task = await makeTask({ title: 'حل واجب الفيزياء' });
    await usePlanningStore.getState().load();

    renderAt('/myplan?tab=tasks');
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

    renderAt('/myplan?tab=tasks');

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
    // نقرأ اليوم المحلي لـ scheduledAt (المُولَّد بتوقيت الجهاز) لا شريحة UTC
    expect(dateKey(new Date(sched!)) >= todayKey()).toBe(true);

    // رسالة النجاح اللطيفة ظهرت واللافتة الأصلية اختفت
    expect(screen.getByText(cal.recovery.applied)).toBeDefined();
    expect(screen.queryByText(cal.recovery.banner)).toBeNull();
  });
});

describe('MyPlan — تأكيد حذف المسار', () => {
  it('الضغطة الأولى تسأل، والإلغاء يبقيه، والتأكيد يحذف المسار وخطواته', async () => {
    const user = userEvent.setup();
    const p = await learningPathRepository.create(makePath({ title: 'مسار للحذف' }));
    await pathItemRepository.create(makeItem({ pathId: p.id, title: 'خطوة واحدة', order: 0, status: 'todo' }));

    renderAt();
    expect(await screen.findByText('مسار للحذف')).toBeDefined();

    // ضغطة واحدة = سؤال، والمسار ما زال موجودًا
    await user.click(screen.getByRole('button', { name: voice.common.delete }));
    expect(await screen.findByText(M.deletePathConfirm)).toBeDefined();
    expect(screen.getByText('مسار للحذف')).toBeDefined();

    // الإلغاء يبقي المسار
    await user.click(screen.getByRole('button', { name: voice.common.cancel }));
    await waitFor(() => {
      expect(screen.queryByText(M.deletePathConfirm)).toBeNull();
    });
    expect(screen.getByText('مسار للحذف')).toBeDefined();

    // التأكيد = حذف حقيقي للمسار
    await user.click(screen.getByRole('button', { name: voice.common.delete }));
    await user.click(screen.getByRole('button', { name: voice.common.delete }));
    await waitFor(() => {
      expect(screen.queryByText('مسار للحذف')).toBeNull();
    });
  });
});

