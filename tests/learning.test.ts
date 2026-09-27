// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات P3: رحلتي (Learning)
// 1) learningEngine: الخطوة القادمة لكل مسار نشط + التقدم
// 2) المستودعات: مسار + عناصر مرتبة + جلسات (roundtrip)
// 3) useLearningStore: load + getNextSteps
// 4) الاندماج: "ماذا أفعل الآن؟" يقترح خطوة تعليمية باحترام حد الصلاة
// 5) بدء خطوة تعليمية يحدّث المسار — لا يُنشئ مهمة مكرّرة
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import {
  learningPathRepository,
  pathItemRepository,
  sessionRepository,
  taskRepository
} from '../src/core/db/repositories';
import { nextSteps, pathProgress } from '../src/core/engines/learningEngine';
import { pathItemToSuggestable, isLearningItem } from '../src/core/engines/suggestionEngine';
import { useLearningStore } from '../src/core/store/useLearningStore';
import { useTodayStore } from '../src/core/store/useTodayStore';
import { useActiveTaskStore } from '../src/core/store/useActiveTaskStore';
import { onLearningChange, type LearningChange } from '../src/core/services/learningEvents';
import { db } from '../src/core/db/schema';
import type { LearningPath, PathItem, TaskRecord, PrayerAnchor } from '../src/core/types';

const ts = { createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' };

function makePath(over: Partial<LearningPath> = {}): LearningPath {
  return {
    id: over.id ?? 'path-1',
    title: over.title ?? 'مادة المحاسبة',
    type: over.type ?? 'university',
    status: over.status ?? 'active',
    order: over.order ?? 0,
    ...ts
  };
}

function makeItem(over: Partial<PathItem> & { pathId: string }): PathItem {
  const { pathId, ...rest } = over;
  return {
    id: rest.id ?? `item-${Math.random().toString(36).slice(2, 8)}`,
    pathId,
    title: rest.title ?? 'محاضرة 1',
    order: rest.order ?? 0,
    status: rest.status ?? 'todo',
    estimatedDuration: rest.estimatedDuration ?? 20,
    ...ts
  };
}

/** جمع إشعارات قناة التعلّم — الاشتراك يُلغى بعد كل اختبار (لا تسريب بين الاختبارات) */
const stops: Array<() => void> = [];
function collectChanges(): LearningChange[] {
  const changes: LearningChange[] = [];
  stops.push(onLearningChange((change) => changes.push(change)));
  return changes;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
  // حالة نظيفة للمهمة الجارية بين الاختبارات (لا مؤقت/جارية من اختبار سابق)
  useActiveTaskStore.setState({
    active: null,
    loaded: false,
    hidden: false,
    pending: null,
    timer: null
  });
  localStorage.clear();
});

afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
});

describe('learningEngine', () => {
  it('الخطوة القادمة = أول عنصر غير مُنجز بترتيب order', () => {
    const path = makePath();
    const items = [
      makeItem({ pathId: path.id, id: 'i3', order: 2, title: 'محاضرة 3' }),
      makeItem({ pathId: path.id, id: 'i1', order: 0, status: 'done', title: 'محاضرة 1' }),
      makeItem({ pathId: path.id, id: 'i2', order: 1, title: 'محاضرة 2' })
    ];
    const steps = nextSteps([path], { [path.id]: items });
    expect(steps).toHaveLength(1);
    expect(steps[0].item.id).toBe('i2');
    expect(steps[0].suggestable.sourceLabel).toBe('مادة المحاسبة');
  });

  it('المسار الموقوف لا يُقترح، والمسار المكتمل لا يعيد شيئًا', () => {
    const paused = makePath({ id: 'p-paused', status: 'paused' });
    const finished = makePath({ id: 'p-done', status: 'done' });
    const active = makePath({ id: 'p-active' });
    const steps = nextSteps(
      [paused, finished, active],
      {
        [paused.id]: [makeItem({ pathId: paused.id })],
        [finished.id]: [makeItem({ pathId: finished.id, status: 'done' })],
        [active.id]: [makeItem({ pathId: active.id })]
      }
    );
    expect(steps).toHaveLength(1);
    expect(steps[0].path.id).toBe('p-active');
  });

  it('pathProgress يحسب المنجز من الإجمالي بلطف', () => {
    const items = [
      makeItem({ pathId: 'p', status: 'done' }),
      makeItem({ pathId: 'p', status: 'done' }),
      makeItem({ pathId: 'p' })
    ];
    expect(pathProgress(items)).toEqual({ done: 2, total: 3 });
  });

  it('pathItemToSuggestable يحمل نوع learning واسم المسار', () => {
    const path = makePath({ title: 'كورس التفسير' });
    const item = makeItem({ pathId: path.id, estimatedDuration: 30 });
    const s = pathItemToSuggestable(item, path.title);
    expect(isLearningItem(s)).toBe(true);
    expect(s.sourceLabel).toBe('كورس التفسير');
    expect(s.estimatedDuration).toBe(30);
  });
});

describe('learning repositories (roundtrip)', () => {
  it('مسار + عناصر مرتبة بـorder + جلسة مربوطة بالعنصر', async () => {
    const path = await learningPathRepository.create(makePath());
    await pathItemRepository.create(makeItem({ pathId: path.id, id: 'a', order: 1, title: 'محاضرة 2' }));
    await pathItemRepository.create(makeItem({ pathId: path.id, id: 'b', order: 0, title: 'محاضرة 1' }));

    const items = await pathItemRepository.getByPath(path.id);
    expect(items.map((i) => i.title)).toEqual(['محاضرة 1', 'محاضرة 2']);

    const next = await pathItemRepository.getNextItem(path.id);
    expect(next?.title).toBe('محاضرة 1');

    await sessionRepository.create({
      pathItemId: 'b',
      date: '2026-01-05T10:00:00.000Z',
      durationMinutes: 25,
      ...ts
    });
    const sessions = await sessionRepository.getByPathItem('b');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].durationMinutes).toBe(25);
  });
});

describe('useLearningStore', () => {
  it('load يجلب كل المسارات وعناصرها (النشط والموقوف)، وgetNextSteps يستثني الموقوف', async () => {
    const path = await learningPathRepository.create(makePath());
    const paused = await learningPathRepository.create(makePath({ id: 'p2', status: 'paused', title: 'موقوف' }));
    await pathItemRepository.create(makeItem({ pathId: path.id, order: 0, title: 'محاضرة 1' }));
    await pathItemRepository.create(makeItem({ pathId: path.id, order: 1, title: 'محاضرة 2' }));
    await pathItemRepository.create(makeItem({ pathId: paused.id, order: 0, title: 'خطوة موقوفة' }));

    await useLearningStore.getState().load();
    const state = useLearningStore.getState();
    expect(state.paths).toHaveLength(2);
    expect(state.itemsByPath[path.id]).toHaveLength(2);
    // عناصر المسار الموقوف تُحمَّل أيضًا — لتعرض «خطتي» تقدّمه وخطواته بصدق
    expect(state.itemsByPath[paused.id]).toHaveLength(1);

    const steps = await state.getNextSteps();
    expect(steps).toHaveLength(1); // الموقوف مستثنى
    expect(steps[0].item.title).toBe('محاضرة 1');
  });

  it('updateItem إلى done يُحدّث الخطوة القادمة', async () => {
    const path = await learningPathRepository.create(makePath());
    await pathItemRepository.create(makeItem({ pathId: path.id, order: 0, title: 'محاضرة 1' }));
    await pathItemRepository.create(makeItem({ pathId: path.id, order: 1, title: 'محاضرة 2' }));
    await useLearningStore.getState().load();

    const first = (await pathItemRepository.getByPath(path.id))[0];
    await useLearningStore.getState().updateItem(first.id, { status: 'done' });

    const steps = await useLearningStore.getState().getNextSteps();
    expect(steps[0].item.title).toBe('محاضرة 2');
  });

  it('updateItem يحافظ على عناصر المسار الموقوف بعد تغيير حالة خطوة', async () => {
    const active = await learningPathRepository.create(makePath());
    const paused = await learningPathRepository.create(makePath({ id: 'p2', status: 'paused', title: 'موقوف' }));
    await pathItemRepository.create(makeItem({ pathId: active.id, order: 0, title: 'محاضرة 1' }));
    await pathItemRepository.create(makeItem({ pathId: paused.id, order: 0, title: 'خطوة موقوفة' }));
    await useLearningStore.getState().load();

    const pausedItem = (await pathItemRepository.getByPath(paused.id))[0];
    await useLearningStore.getState().updateItem(pausedItem.id, { status: 'done' });

    // العناصر لا تُفقد للمسار غير النشط (نفس قاعدة load)
    expect(useLearningStore.getState().itemsByPath[paused.id]).toHaveLength(1);
    expect(useLearningStore.getState().itemsByPath[active.id]).toHaveLength(1);
  });
});

describe('قناة تغيّرات الخطوات (onLearningChange)', () => {
  it('updateItem: كتابة في الـDB + تحديث الحالة المحمّلة + إشعار status واحد بالمسار', async () => {
    const path = await learningPathRepository.create(makePath());
    const item = await pathItemRepository.create(
      makeItem({ pathId: path.id, order: 0, title: 'عنوان قديم' })
    );
    await useLearningStore.getState().load();
    const changes = collectChanges();

    await useLearningStore
      .getState()
      .updateItem(item.id, { title: 'عنوان محدّث', deadline: '2026-02-01T00:00:00.000Z' });

    // الـDB
    const saved = await pathItemRepository.get(item.id);
    expect(saved?.title).toBe('عنوان محدّث');
    expect(saved?.deadline).toBe('2026-02-01T00:00:00.000Z');
    // الحالة المحمّلة (مستهلك «خطتي» المباشر)
    const loaded = useLearningStore.getState().itemsByPath[path.id].find((i) => i.id === item.id);
    expect(loaded?.title).toBe('عنوان محدّث');
    // إشعار واحد فقط، وفيه الخطوة والمسار
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ type: 'status', itemId: item.id, pathId: path.id });
  });

  it('deleteItem: حذف من الـDB + إزالة من الحالة + إشعار removed واحد', async () => {
    const path = await learningPathRepository.create(makePath());
    const keep = await pathItemRepository.create(makeItem({ pathId: path.id, order: 0, title: 'تبقى' }));
    const gone = await pathItemRepository.create(makeItem({ pathId: path.id, order: 1, title: 'تُحذف' }));
    await useLearningStore.getState().load();
    const changes = collectChanges();

    await useLearningStore.getState().deleteItem(gone.id);

    expect(await pathItemRepository.get(gone.id)).toBeUndefined();
    expect(useLearningStore.getState().itemsByPath[path.id].map((i) => i.id)).toEqual([keep.id]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ type: 'removed', itemId: gone.id, pathId: path.id });
  });

  it('addItem ينشر added بالمعرّف الحقيقي المنشأ، وdeletePath ينشر path-removed واحدًا', async () => {
    const path = await learningPathRepository.create(makePath());
    await useLearningStore.getState().load();
    const changes = collectChanges();

    await useLearningStore
      .getState()
      .addItem(makeItem({ pathId: path.id, order: 0, title: 'خطوة جديدة' }));

    expect(changes.map((c) => c.type)).toEqual(['added']);
    expect(changes[0].pathId).toBe(path.id);
    // المعرّف المنشور هو معرّف الـDB (المستودع يولّده) لا معرّفًا مفترضًا من الواجهة
    expect(await pathItemRepository.get(changes[0].itemId ?? '')).toBeDefined();

    await useLearningStore.getState().deletePath(path.id);

    expect(changes.map((c) => c.type)).toEqual(['added', 'path-removed']);
    expect(changes[1].pathId).toBe(path.id);
    expect(await pathItemRepository.getByPath(path.id)).toHaveLength(0);
  });

  it('لا كتابة = لا إشعار: معرّف محذوف/قديم في updateItem وdeleteItem وsetItemStatus', async () => {
    await useLearningStore.getState().load();
    const changes = collectChanges();

    await useLearningStore.getState().updateItem('معرّف-غير-موجود', { title: 'x' });
    await useLearningStore.getState().deleteItem('معرّف-غير-موجود');
    await useLearningStore.getState().setItemStatus('معرّف-غير-موجود', 'in_progress');

    expect(changes).toHaveLength(0);
  });

  it('completeItem: إنجاز واحد = إشعار completed واحد (لا status + completed) + جلسة واحدة', async () => {
    const path = await learningPathRepository.create(makePath());
    const item = await pathItemRepository.create(makeItem({ pathId: path.id, order: 0 }));
    await useLearningStore.getState().load();
    const changes = collectChanges();

    await useLearningStore.getState().completeItem(item.id, undefined, { durationMinutes: 20 });

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ type: 'completed', itemId: item.id, pathId: path.id });
    expect((await pathItemRepository.get(item.id))?.status).toBe('done');
    expect(await sessionRepository.getByPathItem(item.id)).toHaveLength(1);
  });

  it('مستهلك الشريط: حذف الخطوة الجارية يُفرّغ الشريط والمؤقت عبر القناة', async () => {
    const path = await learningPathRepository.create(makePath());
    const item = await pathItemRepository.create(
      makeItem({ pathId: path.id, order: 0, title: 'الخطوة الجارية', estimatedDuration: 25 })
    );
    await useActiveTaskStore.getState().startItem(item.id, 'learning', 'الخطوة الجارية', 25);
    expect(useActiveTaskStore.getState().active?.id).toBe(item.id);

    await useLearningStore.getState().deleteItem(item.id);

    await waitFor(() => {
      expect(useActiveTaskStore.getState().active).toBeNull();
    });
    expect(useActiveTaskStore.getState().timer).toBeNull();
  });

  it('مستهلك «اليوم»: تغيّر خطوة يُبطل لقطة الاقتراح فلا يُقترح خطوة محذوفة', async () => {
    useTodayStore.setState({ suggestion: null, currentPeriod: null });
    const path = await learningPathRepository.create(makePath({ title: 'مسار الاقتراح' }));
    const item = await pathItemRepository.create(
      makeItem({ pathId: path.id, order: 0, title: 'خطوة مقترحة', estimatedDuration: 20 })
    );

    await useTodayStore.getState().askSuggestion(30);
    expect(useTodayStore.getState().suggestion?.task).not.toBeNull();

    await useLearningStore.getState().deleteItem(item.id);

    // اللقطة أُبطلت (إشعار removed) — لا اقتراح بخطوة لم تعد موجودة
    expect(useTodayStore.getState().suggestion).toBeNull();
  });
});

describe('الاندماج: خطوات التعلّم في "ماذا أفعل الآن؟"', () => {
  it('يقترح الخطوة التعليمية (20د) بدل المهمة الأطول داخل فترة 25 دقيقة، والسبب يذكر المسار', async () => {
    // مهمة 45 دقيقة — لا تتسع قبل الصلاة القادمة
    const longTask = await taskRepository.create({
      title: 'مهمة طويلة',
      importance: 'high',
      urgency: 'high',
      estimatedDuration: 45,
      status: 'todo',
      ...ts
    } as TaskRecord);

    // مسار تعليمي بخطوة 20 دقيقة
    const path = await learningPathRepository.create(makePath());
    await pathItemRepository.create(
      makeItem({ pathId: path.id, order: 0, title: 'مراجعة محاضرة', estimatedDuration: 20 })
    );

    // فترة حالية: بين العصر والمغرب — 25 دقيقة متبقية
    const asr: PrayerAnchor = { id: 'pa-asr', date: '2026-01-05', prayer: 'asr', time: '2026-01-05T15:00:00.000Z', source: 'manual', ...ts };
    const maghrib: PrayerAnchor = { id: 'pa-maghrib', date: '2026-01-05', prayer: 'maghrib', time: '2026-01-05T17:25:00.000Z', source: 'manual', ...ts };
    useTodayStore.setState({
      currentPeriod: {
        period: { anchor: 'asr', start: asr.time, end: maghrib.time, remainingMinutes: 25 },
        nextAnchor: maghrib
      }
    });

    await useTodayStore.getState().askSuggestion(60); // المستخدمة عرضت وقتًا أكبر — الصلاة هي السقف
    const { suggestion } = useTodayStore.getState();
    expect(suggestion?.task).toBeTruthy();
    expect(suggestion?.task?.id).not.toBe(longTask.id);
    expect(isLearningItem(suggestion!.task!)).toBe(true);
    expect(suggestion?.reason).toContain('مادة المحاسبة');
  });

  it('startItem لخطوة تعليمية يحدّث المسار ولا يُنشئ مهمة', async () => {
    const path = await learningPathRepository.create(makePath());
    const item = await pathItemRepository.create(
      makeItem({ pathId: path.id, order: 0, title: 'حل واجب', estimatedDuration: 15 })
    );
    const tasksBefore = await taskRepository.getAll();

    // البوابة الوحيدة للمهمة الجارية (useActiveTaskStore) — لا تُنشئ مهمة مكرّرة
    await useActiveTaskStore.getState().startItem(item.id, 'learning', 'حل واجب', 15);

    const updated = await pathItemRepository.get(item.id);
    expect(updated?.status).toBe('in_progress');
    expect(await taskRepository.getAll()).toHaveLength(tasksBefore.length);
  });
});