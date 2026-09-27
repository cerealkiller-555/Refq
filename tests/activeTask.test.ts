// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات Active Task Store (المهمة الجارية + المؤقت)
// قاعدة الواحدة فقط · الاستبدال · الإخفاء · المؤقت (بدء/إيقاف/استئناف/صفر)
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { db } from '../src/core/db/schema';
import {
  taskRepository,
  pathItemRepository,
  learningPathRepository,
  sessionRepository,
  calendarRepository
} from '../src/core/db/repositories';
import { applySchedule } from '../src/core/services/taskLifecycle';
import { useActiveTaskStore, remainingMs } from '../src/core/store/useActiveTaskStore';
import { useLearningStore } from '../src/core/store/useLearningStore';
import { onLearningChange, type LearningChange } from '../src/core/services/learningEvents';
import type { ActiveTimer } from '../src/core/store/useActiveTaskStore';

function resetStore(): void {
  useActiveTaskStore.setState({
    active: null,
    loaded: false,
    hidden: false,
    pending: null,
    timer: null
  });
}

async function seedTask(title: string): Promise<string> {
  const task = await taskRepository.create({
    title,
    importance: 'low',
    urgency: 'low',
    estimatedDuration: 30,
    status: 'todo'
  } as Parameters<typeof taskRepository.create>[0]);
  return task.id;
}

async function seedLearningItem(title: string): Promise<string> {
  const path = await learningPathRepository.create({
    title: 'مسار الاختبار',
    type: 'course',
    status: 'active',
    order: 1
  } as Parameters<typeof learningPathRepository.create>[0]);
  const item = await pathItemRepository.create({
    pathId: path.id,
    title,
    order: 1,
    status: 'todo',
    estimatedDuration: 30
  } as Parameters<typeof pathItemRepository.create>[0]);
  return item.id;
}

describe('Active Task Store', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    localStorage.clear();
    resetStore();
  });

  it('startItem يجعل المهمة in_progress ويشغّل المؤقت', async () => {
    const id = await seedTask('مهمة أولى');
    await useActiveTaskStore.getState().startItem(id, 'task', 'مهمة أولى', 25);

    const st = useActiveTaskStore.getState();
    expect(st.active?.id).toBe(id);
    expect(st.active?.kind).toBe('task');
    expect(st.timer?.plannedMinutes).toBe(25);
    expect(st.timer?.pausedAt).toBeNull();

    const task = await taskRepository.get(id);
    expect(task?.status).toBe('in_progress');
  });

  it('قاعدة الواحدة فقط: بدء مهمة أخرى يعلق الطلب ولا يمس الـDB', async () => {
    const a = await seedTask('الأولى');
    const b = await seedTask('الثانية');
    await useActiveTaskStore.getState().startItem(a, 'task', 'الأولى', 30);

    await useActiveTaskStore.getState().startItem(b, 'task', 'الثانية', 30);
    const st = useActiveTaskStore.getState();
    expect(st.pending?.id).toBe(b);
    expect(st.active?.id).toBe(a); // الأولى ما زالت الجارية

    const second = await taskRepository.get(b);
    expect(second?.status).toBe('todo'); // لم تُبدأ
  });

  it('confirmReplace ترجع القديمة todo وتبدأ الجديدة بمؤقت جديد', async () => {
    const a = await seedTask('القديمة');
    const b = await seedTask('الجديدة');
    await useActiveTaskStore.getState().startItem(a, 'task', 'القديمة', 30);
    await useActiveTaskStore.getState().startItem(b, 'task', 'الجديدة', 45);
    await useActiveTaskStore.getState().confirmReplace();

    const st = useActiveTaskStore.getState();
    expect(st.pending).toBeNull();
    expect(st.active?.id).toBe(b);
    expect(st.timer?.plannedMinutes).toBe(45);

    expect((await taskRepository.get(a))?.status).toBe('todo');
    expect((await taskRepository.get(b))?.status).toBe('in_progress');
  });

  it('completeActive تنهي المهمة وتمسح المؤقت', async () => {
    const id = await seedTask('للإنجاز');
    await useActiveTaskStore.getState().startItem(id, 'task', 'للإنجاز', 30);
    await useActiveTaskStore.getState().completeActive();

    const st = useActiveTaskStore.getState();
    expect(st.active).toBeNull();
    expect(st.timer).toBeNull();
    expect((await taskRepository.get(id))?.status).toBe('done');
  });

  it('pauseTimer يجمّد المتبقي — remainingMs ثابت مع مرور الوقت', async () => {
    const id = await seedTask('موقوفة');
    await useActiveTaskStore.getState().startItem(id, 'task', 'موقوفة', 30);
    useActiveTaskStore.getState().pauseTimer();

    const t = useActiveTaskStore.getState().timer!;
    const atPause = remainingMs(t, Date.now());
    // محاكاة مرور 10 دقائق بعد الإيقاف — المتبقي لا يتغير
    const later = Date.now() + 10 * 60_000;
    expect(remainingMs(t, later)).toBe(atPause);
  });

  it('resumeTimer يستأنف العد من حيث توقف — إيقاف حقيقي قصير لا يُخصم', async () => {
    const id = await seedTask('استئناف');
    await useActiveTaskStore.getState().startItem(id, 'task', 'استئناف', 30);
    useActiveTaskStore.getState().pauseTimer();
    const before = remainingMs(useActiveTaskStore.getState().timer!, Date.now());

    await new Promise((r) => setTimeout(r, 120)); // إيقاف فعلي قصير
    useActiveTaskStore.getState().resumeTimer();

    const t2 = useActiveTaskStore.getState().timer!;
    expect(t2.pausedAt).toBeNull();
    // مدة الإيقاف الفعلية سُجلت (أكثر من 100ms وأقل من ثانيتين)
    expect(t2.pausedTotalMs).toBeGreaterThanOrEqual(100);
    expect(t2.pausedTotalMs).toBeLessThan(2000);

    // بعد الاستئناف المتبقي ≈ ما كان قبل الإيقاف (الفرق أقل من ثانية)
    const after = remainingMs(t2, Date.now());
    expect(before - after).toBeLessThan(1000);

    // تأكيد نقدي لمعادلة الحساب: بدأ قبل 25 دقيقة، منها 10 دقائق إيقاف مسجل
    const now = Date.now();
    const t3: ActiveTimer = {
      id: 'x',
      plannedMinutes: 30,
      startedAt: new Date(now - 25 * 60_000).toISOString(),
      pausedAt: null,
      pausedTotalMs: 10 * 60_000
    };
    // لو كان الإيقاف يُخصم من المتبقي لكانت النتيجة 5 دقائق — الصحيح 15 (25 منقضية − 10 موقوفة)
    expect(remainingMs(t3, now)).toBe(15 * 60_000);
  });

  it('remainingMs مقيّد بالمدة الأصلية — بيانات تالفة لا تُظهر وقتًا إضافيًا', () => {
    const now = Date.now();
    const t: ActiveTimer = {
      id: 'x',
      plannedMinutes: 30,
      startedAt: new Date(now - 5 * 60_000).toISOString(),
      pausedAt: null,
      pausedTotalMs: 10 * 60_000 // إيقاف أكبر من المنقضي — حالة تالفة/مستحيلة
    };
    expect(remainingMs(t, now)).toBe(30 * 60_000);
  });

  it('timeUp: عند انقضاء المدة يكون المتبقي صفرًا حتى لو صُفّر startedAt قديم', () => {
    const t: ActiveTimer = {
      id: 'x',
      plannedMinutes: 15,
      startedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      pausedAt: null,
      pausedTotalMs: 0
    };
    expect(remainingMs(t, Date.now())).toBe(0);
  });

  it('logSession يسجل جلسة للخطوة التعليمية بمدة المؤقت ويمسح المؤقت', async () => {
    const itemId = await seedLearningItem('محاضرة 1');
    await useActiveTaskStore.getState().startItem(itemId, 'learning', 'محاضرة 1', 45);
    await useActiveTaskStore.getState().logSession();

    const sessions = await sessionRepository.getByPathItem(itemId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].durationMinutes).toBe(45);
    expect(useActiveTaskStore.getState().timer).toBeNull();
    // الخطوة تفضل جارية — قرار الإنجاز يبقى بيدها
    expect((await pathItemRepository.get(itemId))?.status).toBe('in_progress');
  });

  it('بدء مهمة أخرى والشريط مخفي: يُظهر السؤال ولا يضيع الطلب', async () => {
    const a = await seedTask('الأولى');
    const b = await seedTask('الثانية');
    await useActiveTaskStore.getState().startItem(a, 'task', 'الأولى', 30);

    useActiveTaskStore.getState().dismiss();
    expect(useActiveTaskStore.getState().hidden).toBe(true);

    await useActiveTaskStore.getState().startItem(b, 'task', 'الثانية', 30);

    const st = useActiveTaskStore.getState();
    expect(st.pending?.id).toBe(b);
    // الشريط عاد ظاهرًا ليُعرض السؤال — فلا يضيع الطلب بصمت
    expect(st.hidden).toBe(false);
    expect(st.active?.id).toBe(a);
    expect((await taskRepository.get(b))?.status).toBe('todo');
  });

  it('لا يبقى سؤال استبدال قديم بعد إتمام المهمة الجارية', async () => {
    const a = await seedTask('تنتهي');
    const b = await seedTask('معلّقة');
    await useActiveTaskStore.getState().startItem(a, 'task', 'تنتهي', 30);
    await useActiveTaskStore.getState().startItem(b, 'task', 'معلّقة', 30);
    expect(useActiveTaskStore.getState().pending?.id).toBe(b);

    await useActiveTaskStore.getState().completeActive();

    const st = useActiveTaskStore.getState();
    expect(st.active).toBeNull();
    expect(st.pending).toBeNull();
  });

  it('load() يمسح طلبًا معلّقًا بلا مهمة جارية (أُنجزت من شاشة أخرى)', async () => {
    const a = await seedTask('خارجية');
    const b = await seedTask('معلّقة');
    await useActiveTaskStore.getState().startItem(a, 'task', 'خارجية', 30);
    await useActiveTaskStore.getState().startItem(b, 'task', 'معلّقة', 30);

    // إنجاز من خارج الشريط (مثل زر ✓ في «اليوم»)
    await taskRepository.complete(a);
    await useActiveTaskStore.getState().load();

    const st = useActiveTaskStore.getState();
    expect(st.active).toBeNull();
    expect(st.pending).toBeNull();
    expect(st.timer).toBeNull();
  });

describe('Active Task — تحرير أحداث المهمة عند الإنجاز (المسار الموحّد)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    resetStore();
  });

  it('completeActive تنهي مهمة مجدولة وتُزيل حدثها المرن (لا شبح في التقويم)', async () => {
    const id = await seedTask('مجدولة للشريط');
    await applySchedule(id, '2026-01-12T15:00:00.000Z');
    expect(await calendarRepository.getByLinkedTask(id)).toHaveLength(1);

    await useActiveTaskStore.getState().startItem(id, 'task', 'مجدولة للشريط', 30);
    await useActiveTaskStore.getState().completeActive();

    expect((await taskRepository.get(id))?.status).toBe('done');
    expect(await calendarRepository.getByLinkedTask(id)).toHaveLength(0);
    expect(useActiveTaskStore.getState().active).toBeNull();
  });
});

describe('Active Task — خطوات التعلّم: الكاتب الوحيد لحالة الخطوة (P0-2)', () => {
  it('إتمام خطوة تعلّم يمرّ بمتجر التعلّم ويحدّث الحالة المحمّلة (تقدّم حيّ في «خطتي»)', async () => {
    useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
    const itemId = await seedLearningItem('محاضرة 1');
    const pathId = (await pathItemRepository.get(itemId))!.pathId;
    await useLearningStore.getState().load();

    await useActiveTaskStore.getState().startItem(itemId, 'learning', 'محاضرة 1', 30);
    await useActiveTaskStore.getState().completeActive();

    expect((await pathItemRepository.get(itemId))?.status).toBe('done');
    // الحالة المحمّلة في المتجر تحدّثت فورًا — بلا إعادة تحميل كاملة
    const items = useLearningStore.getState().itemsByPath[pathId];
    expect(items.find((i) => i.id === itemId)?.status).toBe('done');
    expect(useActiveTaskStore.getState().active).toBeNull();
  });

  it('بدء خطوة تعلّم يكتب in_progress عبر متجر التعلّم بلا إفراغ الشريط', async () => {
    useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
    const itemId = await seedLearningItem('محاضرة 2');
    const pathId = (await pathItemRepository.get(itemId))!.pathId;
    await useLearningStore.getState().load();

    await useActiveTaskStore.getState().startItem(itemId, 'learning', 'محاضرة 2', 25);

    expect((await pathItemRepository.get(itemId))?.status).toBe('in_progress');
    expect(useLearningStore.getState().itemsByPath[pathId].find((i) => i.id === itemId)?.status).toBe('in_progress');
    // البدء ليس إنجازًا — القناة لا تُفرغ الجلسة الجارية
    expect(useActiveTaskStore.getState().active?.id).toBe(itemId);
    expect(useActiveTaskStore.getState().timer?.id).toBe(itemId);
  });

  it('الاستبدال بين خطوتين تعليميتين: الأولى ترجع todo والثانية in_progress بمؤقتها', async () => {
    useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
    const a = await seedLearningItem('الخطوة الأولى');
    const b = await seedLearningItem('الخطوة الثانية');

    await useActiveTaskStore.getState().startItem(a, 'learning', 'الخطوة الأولى', 30);
    await useActiveTaskStore.getState().startItem(b, 'learning', 'الخطوة الثانية', 40);
    expect(useActiveTaskStore.getState().pending?.id).toBe(b);
    // القاعدة: لا كتابة قبل قرار المستخدم
    expect((await pathItemRepository.get(b))?.status).toBe('todo');

    await useActiveTaskStore.getState().confirmReplace();

    expect((await pathItemRepository.get(a))?.status).toBe('todo');
    expect((await pathItemRepository.get(b))?.status).toBe('in_progress');
    expect(useActiveTaskStore.getState().active?.id).toBe(b);
    expect(useActiveTaskStore.getState().timer?.id).toBe(b);
    expect(useActiveTaskStore.getState().timer?.plannedMinutes).toBe(40);
  });

  it('إكمال الخطوة من شاشة أخرى («خطتي») يوقف الجلسة ويمسح المؤقت بلا لمس الشريط', async () => {
    useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
    const itemId = await seedLearningItem('محاضرة 3');
    await useActiveTaskStore.getState().startItem(itemId, 'learning', 'محاضرة 3', 30);
    expect(useActiveTaskStore.getState().active?.id).toBe(itemId);
    expect(useActiveTaskStore.getState().timer?.id).toBe(itemId);

    // كما لو أنها أُنجزت من «خطتي» — القناة وحدها تكفي
    await useLearningStore.getState().completeItem(itemId);

    await waitFor(() => {
      expect(useActiveTaskStore.getState().active).toBeNull();
    });
    expect(useActiveTaskStore.getState().timer).toBeNull();
    expect((await pathItemRepository.get(itemId))?.status).toBe('done');
  });
});
  describe('تسجيل الجلسة عند الإنجاز (P0-3)', () => {
    it('الإنجاز من الشريط يسجّل جلسة واحدة بمدة المؤقت ويحدّث جلسات المتجر فورًا', async () => {
      useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
      const itemId = await seedLearningItem('محاضرة الأصول');
      await useActiveTaskStore.getState().startItem(itemId, 'learning', 'محاضرة الأصول', 45);

      await useActiveTaskStore.getState().completeActive();

      const sessions = await sessionRepository.getByPathItem(itemId);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].durationMinutes).toBe(45);
      // المتجر محدّث بلا إعادة تحميل ← «آخر توقف» والعدّ يتحدّثان حيًّا
      expect(
        useLearningStore.getState().sessions.filter((s) => s.pathItemId === itemId)
      ).toHaveLength(1);
      expect((await pathItemRepository.get(itemId))?.status).toBe('done');
      expect(useActiveTaskStore.getState().active).toBeNull();
      expect(useActiveTaskStore.getState().timer).toBeNull();
    });

    it('بعد «سجّلي الجلسة»: الإنجاز لا ينتج جلسة مزدوجة', async () => {
      useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
      const itemId = await seedLearningItem('محاضرة الفقه');
      await useActiveTaskStore.getState().startItem(itemId, 'learning', 'محاضرة الفقه', 30);

      await useActiveTaskStore.getState().logSession(); // الجلسة سُجّلت من المؤقت
      expect(await sessionRepository.getByPathItem(itemId)).toHaveLength(1);

      await useActiveTaskStore.getState().completeActive(); // ثم جاء الإنجاز من الشريط

      expect(await sessionRepository.getByPathItem(itemId)).toHaveLength(1); // لا تكرار
      expect((await pathItemRepository.get(itemId))?.status).toBe('done');
      expect(useActiveTaskStore.getState().active).toBeNull();
      expect(useActiveTaskStore.getState().timer).toBeNull();
    });

    it('الإنجاز من «خطتي» أثناء جلسة تعمل عليها يسجّل جلسة واحدة ويوقف الجلسة', async () => {
      useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
      const itemId = await seedLearningItem('محاضرة النحو');
      await useActiveTaskStore.getState().startItem(itemId, 'learning', 'محاضرة النحو', 40);

      await useActiveTaskStore.getState().completeItem(itemId); // كما يفعل زر «تم» في «خطتي»

      const sessions = await sessionRepository.getByPathItem(itemId);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].durationMinutes).toBe(40);
      expect((await pathItemRepository.get(itemId))?.status).toBe('done');
      expect(useActiveTaskStore.getState().active).toBeNull();
      expect(useActiveTaskStore.getState().timer).toBeNull();
    });

    it('بلا جلسة مفتوحة: الإنجاز يكتمل بلا جلسة مخترعة', async () => {
      useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
      const itemId = await seedLearningItem('محاضرة بلا مؤقت');
      await useActiveTaskStore.getState().startItem(itemId, 'learning', 'محاضرة بلا مؤقت', 30);
      useActiveTaskStore.getState().clearTimer(); // «متابعة» بلا تسجيل

      await useActiveTaskStore.getState().completeItem(itemId);

      expect(await sessionRepository.getByPathItem(itemId)).toHaveLength(0);
      expect((await pathItemRepository.get(itemId))?.status).toBe('done');
    });

    it('إنجاز خطوة أخرى لا يستهلك جلسة الخطوة الجارية', async () => {
      useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
      const running = await seedLearningItem('الجارية');
      const other = await seedLearningItem('أخرى');
      await useActiveTaskStore.getState().startItem(running, 'learning', 'الجارية', 30);

      await useActiveTaskStore.getState().completeItem(other);

      expect(await sessionRepository.getByPathItem(other)).toHaveLength(0);
      expect(await sessionRepository.getByPathItem(running)).toHaveLength(0);
      // جلسة «الجارية» ما زالت مفتوحة ومستمرة كما هي
      expect(useActiveTaskStore.getState().active?.id).toBe(running);
      expect(useActiveTaskStore.getState().timer?.id).toBe(running);
      expect((await pathItemRepository.get(other))?.status).toBe('done');
    });

    it('نداءان متزامنان لنفس الخطوة = جلسة واحدة (ضغطة مزدوجة)', async () => {
      useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
      const itemId = await seedLearningItem('محاضرة الضغطة');
      await useActiveTaskStore.getState().startItem(itemId, 'learning', 'محاضرة الضغطة', 35);

      await Promise.all([
        useActiveTaskStore.getState().completeItem(itemId),
        useActiveTaskStore.getState().completeItem(itemId)
      ]);

      expect(await sessionRepository.getByPathItem(itemId)).toHaveLength(1);
    });

    it('إنجاز مهمة (task) لا يسجّل جلسة تعلّم — دورة حياة المهمة كما هي', async () => {
      useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
      const id = await seedTask('مهمة إدارية');
      await useActiveTaskStore.getState().startItem(id, 'task', 'مهمة إدارية', 30);

      await useActiveTaskStore.getState().completeActive();

      expect((await taskRepository.get(id))?.status).toBe('done');
      expect(await sessionRepository.getAll()).toHaveLength(0);
      expect(useActiveTaskStore.getState().active).toBeNull();
      expect(useActiveTaskStore.getState().timer).toBeNull();
    });
  });



});

describe('قناة التعلّم من الشريط (الكاتب الوحيد: متجر التعلّم)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    localStorage.clear();
    resetStore();
    useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
  });

  /** جمع إشعارات قناة التعلّم — الاشتراك يُلغى بعد الاختبار */
  function collectChanges(): { changes: LearningChange[]; stop: () => void } {
    const changes: LearningChange[] = [];
    const stop = onLearningChange((change) => changes.push(change));
    return { changes, stop };
  }

  it('startItem لخطوة تعلّم: الكتابة تمرّ عبر متجر التعلّم وتُنشَر على قناته (status واحد)', async () => {
    const id = await seedLearningItem('خطوة القناة');
    const { changes, stop } = collectChanges();
    try {
      await useActiveTaskStore.getState().startItem(id, 'learning', 'خطوة القناة', 25);
    } finally {
      stop();
    }

    // لا كتابة مباشرة إلى الـDB من الشريط: الحالة تغيّرت والإشعار جاء من الكاتب الوحيد
    expect((await pathItemRepository.get(id))?.status).toBe('in_progress');
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('status');
    expect(changes[0].itemId).toBe(id);
    expect(changes[0].pathId).toBeTruthy();
  });

  it('إكمال خطوة من الشريط: إشعار completed واحد + جلسة واحدة (لا تكرار)', async () => {
    const id = await seedLearningItem('خطوة الإكمال');
    await useActiveTaskStore.getState().startItem(id, 'learning', 'خطوة الإكمال', 25);

    const { changes, stop } = collectChanges();
    try {
      await useActiveTaskStore.getState().completeItem(id);
    } finally {
      stop();
    }

    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('completed');
    expect((await pathItemRepository.get(id))?.status).toBe('done');
    expect(await sessionRepository.getByPathItem(id)).toHaveLength(1);
    expect(useActiveTaskStore.getState().timer).toBeNull();
  });

  it('عملية الشريط = قراءة واحدة لحالة النشاط (لا تحميلان مكرّران لنفس العملية)', async () => {
    const id = await seedLearningItem('خطوة بقراءة واحدة');
    await useActiveTaskStore.getState().load(); // تحميل أولي — حالة الشريط جاهزة

    const spy = vi.spyOn(taskRepository, 'getOpenTasks');
    try {
      await useActiveTaskStore.getState().startItem(id, 'learning', 'خطوة بقراءة واحدة', 25);
      // الشريط يقرأ بنفسه بعد البدء مرة واحدة — إشعار عمليته لا يُعيد القراءة
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('دورة حياة المهمة لا تُطلق إشعار قناة التعلّم (القناتان منفصلتان)', async () => {
    const id = await seedTask('مهمة إدارية للفصل');
    const { changes, stop } = collectChanges();
    try {
      await useActiveTaskStore.getState().startItem(id, 'task', 'مهمة إدارية للفصل', 30);
      await useActiveTaskStore.getState().completeActive();

      expect((await taskRepository.get(id))?.status).toBe('done');
      expect(useActiveTaskStore.getState().active).toBeNull();
    } finally {
      stop();
    }
    expect(changes).toHaveLength(0);
    expect(await sessionRepository.getAll()).toHaveLength(0);
  });
});

