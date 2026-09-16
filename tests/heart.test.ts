// ============================================================
// رِفق — اختبارات القلب (P5): تأملات + نصوص شرعية
// الصلة: مصدر النص دائمًا إلزامي، والتأمل بلا أحكام
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/core/db/schema';
import {
  reflectionRepository,
  shariaRepository,
  learningPathRepository,
  pathItemRepository
} from '../src/core/db/repositories';
import { useHeartStore } from '../src/core/store/useHeartStore';
import { useShariaStore } from '../src/core/store/useShariaStore';

beforeEach(async () => {
  await db.delete();
  await db.open();
  useHeartStore.setState({ reflections: [] });
  useShariaStore.setState({ texts: [] });
});

describe('القلب — التأملات (repository)', () => {
  it('تسجيل أثر مربوط بخطوة مسار + skip بلا إجابات', async () => {
    const r = await reflectionRepository.addEntry(
      'athar',
      { feeling: 'خفيفة', benefit: 'فهمت التثبيت' },
      { linkedPathItemId: 'item1' }
    );
    expect(r.kind).toBe('athar');
    expect(r.linkedPathItemId).toBe('item1');
    expect(r.skipped).toBe(false);

    const skipped = await reflectionRepository.addEntry('waqfa', {}, { skipped: true });
    expect(skipped.skipped).toBe(true);
    expect(Object.keys(skipped.answers).length).toBe(0);
  });

  it('getByDate يجلب تأملات اليوم فقط', async () => {
    await reflectionRepository.addEntry('muhasaba', { good: 'صلاة عصر في وقتها' });
    const today = new Date().toISOString().slice(0, 10);
    const found = await reflectionRepository.getByDate(today, 'muhasaba');
    expect(found.length).toBe(1);
    expect(found[0].kind).toBe('muhasaba');
  });
});

describe('القلب — store (تدفق كامل بلا أحكام)', () => {
  it('addReflection يحدث الحالة والسجل معًا', async () => {
    const store = useHeartStore.getState();
    await store.load();
    await store.addReflection('search_heart', { need: 'وضوح' });
    const state = useHeartStore.getState();
    expect(state.reflections.length).toBe(1);
    expect(state.reflections[0].kind).toBe('search_heart');
    expect(state.reflections[0].answers.need).toBe('وضوح');
  });

  it('getTodayByKind يعيد تأمل اليوم لنفس النوع', async () => {
    const store = useHeartStore.getState();
    await store.addReflection('athar', { feeling: 'راحة' });
    const found = await useHeartStore.getState().getTodayByKind('athar');
    expect(found?.kind).toBe('athar');
  });
});

describe('النصوص الشرعية — المصدر إلزامي دائمًا', () => {
  it('إضافة نص بمصدره + ربطه بمسار علم شرعي', async () => {
    const path = await learningPathRepository.create({
      title: 'علم الشرح',
      type: 'religious_science',
      status: 'active',
      order: 1
    } as never);
    await pathItemRepository.create({
      pathId: path.id,
      title: 'متن 1',
      order: 1,
      status: 'todo'
    } as never);

    const t = await shariaRepository.addText(
      'hadith',
      'من أراد الله به خيرًا فقهه في الدين',
      'صحيح البخاري',
      { pathId: path.id }
    );
    expect(t.source).toBe('صحيح البخاري');
    expect(t.pathId).toBe(path.id);

    const byPath = await shariaRepository.getByPath(path.id);
    expect(byPath.length).toBe(1);

    const byKind = await shariaRepository.getByKind('hadith');
    expect(byKind.length).toBe(1);
  });

  it('sharia store — addText ثم deleteText يحدثا الحالة فورًا', async () => {
    const store = useShariaStore.getState();
    await store.load();
    await store.addText('faida', 'الراحة في القلب', 'شرح التأمل');
    expect(useShariaStore.getState().texts.length).toBe(1);

    const id = useShariaStore.getState().texts[0].id;
    await store.deleteText(id);
    expect(useShariaStore.getState().texts.length).toBe(0);
  });
});
