// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات واجهة خطتي (MyPlanPage)
// 1) عرض حالة الفراغ عندما لا توجد مسارات
// 2) عرض المواد مع نسبة الإنجاز وحساب "أين توقفتِ؟" والخطوة القادمة
// 3) إطلاق جلسة دراسية يفعّل ActiveTaskBar وuseActiveTaskStore
// 4) توسيع وطي قائمة الخطوات للمادة
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyPlanPage } from '../../src/ui/screens/myplan/MyPlanPage';
import { useLearningStore } from '../../src/core/store/useLearningStore';
import { useActiveTaskStore } from '../../src/core/store/useActiveTaskStore';
import { db } from '../../src/core/db/schema';
import { learningPathRepository, pathItemRepository, sessionRepository } from '../../src/core/db/repositories';
import { voice } from '../../src/i18n/voice';
import type { LearningPath, PathItem } from '../../src/core/types';

const M = voice.myPlan;

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

beforeEach(async () => {
  await db.delete();
  await db.open();
  useLearningStore.setState({ paths: [], itemsByPath: {}, sessions: [] });
  useActiveTaskStore.setState({ active: null, timer: null });
});

afterEach(() => cleanup());

describe('MyPlanPage UI — خطتي', () => {
  it('يعرض رسالة الفراغ الهادئة عند عدم وجود أي مسارات', async () => {
    render(<MyPlanPage />);
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

    render(<MyPlanPage />);

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

    render(<MyPlanPage />);

    const startBtn = await screen.findByRole('button', { name: /ابدئي جلسة/ });
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

    render(<MyPlanPage />);

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
