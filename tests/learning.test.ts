// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات P3: رحلتي (Learning)
// 1) learningEngine: الخطوة القادمة لكل مسار نشط + التقدم
// 2) المستودعات: مسار + عناصر مرتبة + جلسات (roundtrip)
// 3) useLearningStore: load + getNextSteps
// 4) الاندماج: "ماذا أفعل الآن؟" يقترح خطوة تعليمية باحترام حد الصلاة
// 5) بدء خطوة تعليمية يحدّث المسار — لا يُنشئ مهمة مكرّرة
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
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

beforeEach(async () => {
  await db.delete();
  await db.open();
  useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
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
  it('load يجلب المسارات النشطة وعناصرها، وgetNextSteps يعيدها', async () => {
    const path = await learningPathRepository.create(makePath());
    await learningPathRepository.create(makePath({ id: 'p2', status: 'paused', title: 'موقوف' }));
    await pathItemRepository.create(makeItem({ pathId: path.id, order: 0, title: 'محاضرة 1' }));
    await pathItemRepository.create(makeItem({ pathId: path.id, order: 1, title: 'محاضرة 2' }));

    await useLearningStore.getState().load();
    const state = useLearningStore.getState();
    expect(state.paths).toHaveLength(2);
    expect(state.itemsByPath[path.id]).toHaveLength(2);

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

  it('startSuggestedItem لخطوة تعليمية يحدّث المسار ولا يُنشئ مهمة', async () => {
    const path = await learningPathRepository.create(makePath());
    const item = await pathItemRepository.create(
      makeItem({ pathId: path.id, order: 0, title: 'حل واجب', estimatedDuration: 15 })
    );
    const tasksBefore = await taskRepository.getAll();

    await useTodayStore.getState().startSuggestedItem(item.id, 'learning');

    const updated = await pathItemRepository.get(item.id);
    expect(updated?.status).toBe('in_progress');
    expect(await taskRepository.getAll()).toHaveLength(tasksBefore.length);
  });
});