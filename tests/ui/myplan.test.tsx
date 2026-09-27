// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات واجهة خطتي (MyPlanPage) الموحّدة
// 1) عرض حالة الفراغ عندما لا توجد مسارات
// 2) عرض المواد مع نسبة الإنجاز وحساب "أين توقفتِ؟" والخطوة القادمة
// 3) إطلاق جلسة دراسية يفعّل ActiveTaskBar وuseActiveTaskStore
// 4) توسيع وطي قائمة الخطوات للمادة
// 5) صفحة واحدة بلا تبويبات: اللمحة، الجدولة، لافتة اليوم الفائت،
//    و?tab=tasks كتوافق خلفي مؤقت فقط
// 6) الموعد النهائي للخطوة (deadline) + تحرير/حذف الخطوة من صفها
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
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
const L = voice.learning;

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

describe('MyPlanPage UI — المهام المباشرة داخل خطتي (بلا تبويبات)', () => {
  it('صفحة واحدة: لا تبويبات — المسارات وقسم المهام يظهران معًا', async () => {
    await learningPathRepository.create(makePath({ title: 'مادة موحّدة' }));

    renderAt();

    // المسارات…
    expect(await screen.findByText('مادة موحّدة')).toBeDefined();
    // …وقسم المهام المباشرة في الصفحة نفسها، بلا أي تبويب
    expect(await screen.findByPlaceholderText(voice.planning.quickAddPlaceholder)).toBeDefined();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryAllByRole('tablist')).toHaveLength(0);
    // ولمحة المهام أعلى الصفحة
    expect(screen.getByText(/مهمة مفتوحة/)).toBeDefined();
  });

  it('?tab=tasks يبقى مدعومًا كتوافق خلفي: يفتح خطتي مع قسم المهام بلا انهيار', async () => {
    await learningPathRepository.create(makePath({ title: 'مادة الرابط القديم' }));

    renderAt('/myplan?tab=tasks');

    expect(await screen.findByText('مادة الرابط القديم')).toBeDefined();
    expect(await screen.findByPlaceholderText(voice.planning.quickAddPlaceholder)).toBeDefined();
    // قسم المهام موجود كمرساة تمرير للروابط القديمة
    expect(document.getElementById('direct-tasks')).not.toBeNull();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('جدولة مهمة من لوحة المهام تنشئ حدثًا مربوطًا', async () => {
    const user = userEvent.setup();
    const task = await makeTask({ title: 'حل واجب الفيزياء' });
    await usePlanningStore.getState().load();

    renderAt();
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

    renderAt();

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

  it('الموعد النهائي للخطوة: يُحفظ ظهيرةً محليًّا ويظهر شارة، والمتأخرة تُعلَّم «متأخرة»', async () => {
    const user = userEvent.setup();
    const p = await learningPathRepository.create(makePath({ title: 'مسار المواعيد' }));
    const due = addDaysKey(todayKey(), 3);

    renderAt();
    expect(await screen.findByText('مسار المواعيد')).toBeDefined();

    // إضافة خطوة بموعد نهائي من نموذج الخطوة
    await user.click(await screen.findByRole('button', { name: `＋ ${L.addItem}` }));
    await user.type(await screen.findByPlaceholderText(L.addItemPlaceholder), 'ورقة بحثية');
    fireEvent.change(screen.getByLabelText(M.itemDeadline), { target: { value: due } });
    await user.click(screen.getByRole('button', { name: L.addItem }));

    // يُخزَّن ظهيرةً محليًّا — نفس عُرف المهام، بلا إزاحة يوم
    await waitFor(async () => {
      const saved = await pathItemRepository.getByPath(p.id);
      expect(saved).toHaveLength(1);
      expect(saved[0].deadline).toBe(new Date(`${due}T12:00:00`).toISOString());
    });
    const savedItem = (await pathItemRepository.getByPath(p.id))[0];
    expect(dateKey(new Date(savedItem.deadline!))).toBe(due);

    // الشارة تظهر في صف الخطوة، ولا «متأخرة» لموعد قادم
    await user.click(await screen.findByRole('button', { name: new RegExp(M.expandItems) }));
    const list = await screen.findByRole('list', { name: 'مسار المواعيد' });
    expect(within(list).getByText(M.dueChip.replace('{date}', due))).toBeDefined();
    expect(within(list).queryByText(`⏳ ${M.overdueChip}`)).toBeNull();

    // وخطوة موعدها مضى تُعلَّم «متأخرة»
    await pathItemRepository.create(
      makeItem({
        pathId: p.id,
        title: 'خطوة متأخرة الموعد',
        order: 1,
        deadline: new Date(`${addDaysKey(todayKey(), -2)}T12:00:00`).toISOString()
      })
    );
    await useLearningStore.getState().load();
    await waitFor(() => {
      expect(within(list).getByText(`⏳ ${M.overdueChip}`)).toBeDefined();
    });
  });

  it('تحرير عنوان الخطوة من صفها وحذفها بتأكيد واحد', async () => {
    const user = userEvent.setup();
    const p = await learningPathRepository.create(makePath({ title: 'مسار الصف' }));
    const step = await pathItemRepository.create(makeItem({ pathId: p.id, title: 'عنوان قديم', order: 0 }));

    renderAt();
    expect(await screen.findByText('مسار الصف')).toBeDefined();
    await user.click(await screen.findByRole('button', { name: new RegExp(M.expandItems) }));

    const list = await screen.findByRole('list', { name: 'مسار الصف' });
    // الضغط على العنوان يفتح محررًا داخل الصف — كالمهام
    await user.click(within(list).getByText('عنوان قديم'));
    const editor = await screen.findByLabelText(voice.common.edit);
    await user.clear(editor);
    await user.type(editor, 'عنوان محدّث{Enter}');

    await waitFor(async () => {
      expect((await pathItemRepository.get(step.id))?.title).toBe('عنوان محدّث');
    });
    await waitFor(() => {
      expect(within(list).getByText('عنوان محدّث')).toBeDefined();
    });
    const row = within(list).getByText('عنوان محدّث').closest('li');
    expect(row).not.toBeNull();
    const rowEl = row as HTMLElement;

    // الحذف: ضغطة تسأل…
    await user.click(within(rowEl).getByRole('button', { name: voice.common.delete }));
    expect(within(rowEl).getByText(M.deleteItemConfirm)).toBeDefined();
    expect(await pathItemRepository.getAll()).toHaveLength(1);

    // …وتأكيد واحد يحذف
    await user.click(within(rowEl).getByRole('button', { name: voice.common.delete }));
    await waitFor(async () => {
      expect(await pathItemRepository.get(step.id)).toBeUndefined();
    });
    expect(screen.queryByText('عنوان محدّث')).toBeNull();
  });

  it('حذف الخطوة الجارية من صفّها يُفرّغ الشريط عبر قناة التعلّم (بلا نداء تحميل موضعي)', async () => {
    const user = userEvent.setup();
    const p = await learningPathRepository.create(makePath({ title: 'مسار الحذف الجاري' }));
    const step = await pathItemRepository.create(
      makeItem({ pathId: p.id, title: 'الخطوة الجارية', order: 0, estimatedDuration: 20 })
    );
    // خطوة جارية فعلًا في الشريط (مؤقت مفتوح)
    await useActiveTaskStore.getState().startItem(step.id, 'learning', 'الخطوة الجارية', 20);
    expect(useActiveTaskStore.getState().active?.id).toBe(step.id);

    renderAt();
    expect(await screen.findByText('مسار الحذف الجاري')).toBeDefined();
    await user.click(await screen.findByRole('button', { name: new RegExp(M.expandItems) }));

    const list = await screen.findByRole('list', { name: 'مسار الحذف الجاري' });
    const row = within(list).getByText('الخطوة الجارية').closest('li') as HTMLElement;
    // ضغطة تسأل، وتأكيد واحد يحذف
    await user.click(within(row).getByRole('button', { name: voice.common.delete }));
    await user.click(within(row).getByRole('button', { name: voice.common.delete }));

    await waitFor(async () => {
      expect(await pathItemRepository.get(step.id)).toBeUndefined();
    });
    // الشريط تفرّغ عبر إشعار القناة (removed) — لا نداء load من الشاشة
    await waitFor(() => {
      expect(useActiveTaskStore.getState().active).toBeNull();
    });
    expect(useActiveTaskStore.getState().timer).toBeNull();
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

describe('MyPlanPage — صحة حالات المسار (P0-1)', () => {
  it('المسار الموقوف يعرض خطواته وتقدّمه ولا يقول «أتممتِ كل خطواته»', async () => {
    const p = await learningPathRepository.create(makePath({ title: 'تفسير موقوف', status: 'paused' }));
    await pathItemRepository.create(makeItem({ pathId: p.id, title: 'سورة الكوثر', order: 0, status: 'done' }));
    await pathItemRepository.create(makeItem({ pathId: p.id, title: 'سورة الناس', order: 1, status: 'todo' }));

    renderAt();

    // البطاقة تظهر بحالتها الصحيحة…
    expect(await screen.findByText('تفسير موقوف')).toBeDefined();
    expect(screen.getByText(M.pausedTag)).toBeDefined();
    // …وتقدّمها الحقيقي محسوبًا من خطواتها المحمَّلة (1 من 2)
    expect(screen.getByText(/أُنجز 1 من 2/)).toBeDefined();
    // الخطأ القديم: لا بانر «أتممتِ كل خطوات» لمسار لم يكمل خطواته
    expect(screen.queryByText(M.allDone)).toBeNull();
    // وخطوته التالية ظاهرة، وقائمة خطواته متاحة (كانت تختفي تمامًا)
    expect(screen.getByText('سورة الناس')).toBeDefined();
    expect(screen.getByRole('button', { name: new RegExp(M.expandItems) })).toBeDefined();
  });

  it('المسار بلا خطوات: «لا خطوات بعد» — لا «أتممتِ كل خطوات» ولا تقدّم وهمي', async () => {
    await learningPathRepository.create(makePath({ title: 'مسار بلا خطوات' }));

    renderAt();

    expect(await screen.findByText('مسار بلا خطوات')).toBeDefined();
    expect(screen.getByText(M.noStepsYet)).toBeDefined();
    expect(screen.queryByText(M.allDone)).toBeNull();
    // لا شريط تقدّم «أُنجز 0 من 0»
    expect(screen.queryByText(/أُنجز 0 من 0/)).toBeNull();
  });

  it('المسار المكتملة خطواته: يظهر بانر الأتمتة ولا يظهر نص «لا خطوات بعد»', async () => {
    const p = await learningPathRepository.create(makePath({ title: 'كتاب أُتمّ' }));
    await pathItemRepository.create(makeItem({ pathId: p.id, title: 'الفصل الأول', order: 0, status: 'done' }));

    renderAt();

    expect(await screen.findByText('كتاب أُتمّ')).toBeDefined();
    expect(screen.getByText(M.allDone)).toBeDefined();
    expect(screen.queryByText(M.noStepsYet)).toBeNull();
    expect(screen.getByText(/أُنجز 1 من 1/)).toBeDefined();
  });
});

describe('MyPlanPage UI — إنجاز الخطوات من الصف (P0-2)', () => {
  it('زر «تم» يُنجز الخطوة: الـDB + تقدّم حيّ + اختفاء الزر، ثم بانر الأتمتة', async () => {
    const user = userEvent.setup();
    const p = await learningPathRepository.create(makePath({ title: 'مسار الإنجاز' }));
    const first = await pathItemRepository.create(makeItem({ pathId: p.id, title: 'الخطوة الأولى', order: 0 }));
    await pathItemRepository.create(makeItem({ pathId: p.id, title: 'الخطوة الثانية', order: 1 }));

    renderAt();
    expect(await screen.findByText('مسار الإنجاز')).toBeDefined();
    await user.click(await screen.findByRole('button', { name: /عرض كل الخطوات/ }));

    // زر «تم» لكل خطوة غير منجزة
    expect(screen.getAllByRole('button', { name: 'تم' })).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: 'تم' })[0]);

    expect((await pathItemRepository.get(first.id))?.status).toBe('done');
    await waitFor(() => {
      expect(screen.getByText(/أُنجز 1 من 2/)).toBeDefined();
    });
    expect(screen.getAllByRole('button', { name: 'تم' })).toHaveLength(1);

    // إنجاز الثانية ← البانر واختفاء كل الأزرار
    await user.click(screen.getAllByRole('button', { name: 'تم' })[0]);
    await waitFor(() => {
      expect(screen.getByText(M.allDone)).toBeDefined();
    });
    expect(screen.getByText(/أُنجز 2 من 2/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'تم' })).toBeNull();
  });

  it('إنجاز الخطوة الجارية من «خطتي» يوقف الجلسة ويسجّل جلسة واحدة ويحدّث آخر توقف والعدّ', async () => {
    const user = userEvent.setup();
    const p = await learningPathRepository.create(makePath({ title: 'مسار الجلسة' }));
    const only = await pathItemRepository.create(
      makeItem({ pathId: p.id, title: 'خطوة وحيدة', order: 0, estimatedDuration: 25 })
    );

    renderAt();
    expect(await screen.findByText('مسار الجلسة')).toBeDefined();

    await user.click(await screen.findByRole('button', { name: /ابدئي جلسة/ }));
    await waitFor(() => {
      expect(useActiveTaskStore.getState().active?.id).toBe(only.id);
    });
    expect(useActiveTaskStore.getState().timer?.plannedMinutes).toBe(25);

    // إنجازها من الصف — القناة وحدها توقف الجلسة
    await user.click(await screen.findByRole('button', { name: /عرض كل الخطوات/ }));
    await user.click(screen.getByRole('button', { name: 'تم' }));

    await waitFor(() => {
      expect(useActiveTaskStore.getState().active).toBeNull();
    });
    expect(useActiveTaskStore.getState().timer).toBeNull();
    expect((await pathItemRepository.get(only.id))?.status).toBe('done');
    expect(await screen.findByText(M.allDone)).toBeDefined();
    // جلسة واحدة بمدة المؤقت — لا صفر ولا اثنتان
    const sessions = await sessionRepository.getByPathItem(only.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].durationMinutes).toBe(25);
    // «آخر توقف» وعدّ الجلسات يعكسان التسجيل الجديد فورًا
    expect(screen.getByText(/«خطوة وحيدة»/)).toBeDefined();
    expect(screen.getByText('1 جلسات مسجلة')).toBeDefined();
  });

  it('إنجاز خطوة بلا جلسة مفتوحة لا يخترع جلسة ولا عدًّا وهميًّا', async () => {
    const user = userEvent.setup();
    const p = await learningPathRepository.create(makePath({ title: 'مسار بلا مؤقت' }));
    const only = await pathItemRepository.create(
      makeItem({ pathId: p.id, title: 'خطوة سريعة', order: 0 })
    );

    renderAt();
    expect(await screen.findByText('مسار بلا مؤقت')).toBeDefined();

    // إنجاز مباشر بلا مؤقت جارٍ ← لا جلسة تُخترع
    await user.click(await screen.findByRole('button', { name: /عرض كل الخطوات/ }));
    await user.click(screen.getByRole('button', { name: 'تم' }));

    expect(await screen.findByText(M.allDone)).toBeDefined();
    expect(await sessionRepository.getByPathItem(only.id)).toHaveLength(0);
    expect(screen.queryByText(/جلسات مسجلة/)).toBeNull();
    // «آخر توقف» يظل معروضًا من سجل الخطوة المكتملة (لا فراغ في الواجهة)
    expect(screen.getByText(/«خطوة سريعة»/)).toBeDefined();
  });
});

