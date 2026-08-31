// ============================================================
// رِفق — اختبارات المحركات (P0.4)
// Priority · Suggestion · Recovery
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  rankTasks,
  getTopPriorities
} from '../src/core/engines/priorityEngine';
import { suggestTask } from '../src/core/engines/suggestionEngine';
import { recomputePlan } from '../src/core/engines/recoveryEngine';
import type { TaskRecord, CalendarEvent } from '../src/core/types';

function makeTask(partial: Partial<TaskRecord> = {}): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: 't1',
    title: 'مهمة',
    importance: 'low',
    urgency: 'low',
    estimatedDuration: 30,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
    ...partial
  };
}

// ===== Priority Engine =====

describe('PriorityEngine', () => {
  const now = '2026-01-10T10:00:00.000Z';

  it('مهمة عاجلة ومهمة تسبق غير عاجلة وغير مهمة', () => {
    const urgentImportant = makeTask({ id: 'a', importance: 'high', urgency: 'high' });
    const notUrgent = makeTask({ id: 'b', importance: 'low', urgency: 'low' });
    const ranked = rankTasks([notUrgent, urgentImportant], now);
    expect(ranked[0].task.id).toBe('a');
  });

  it('مهمة ذات deadline قريب تتفوق على مهمة مماثلة بلا deadline', () => {
    const soonDeadline = makeTask({
      id: 'a',
      importance: 'low',
      urgency: 'low',
      deadline: '2026-01-11T10:00:00.000Z' // بعد يوم
    });
    const noDeadline = makeTask({ id: 'b', importance: 'low', urgency: 'low' }); // مطابقة تمامًا
    const ranked = rankTasks([noDeadline, soonDeadline], now);
    expect(ranked[0].task.id).toBe('a');
  });

  it('deadline القريب يرتفع لكن لا يتجاوز أهمية تناولية عالية جدًا (توازن)', () => {
    const soonDeadline = makeTask({ id: 'a', importance: 'low', urgency: 'low', deadline: '2026-01-11T10:00:00.000Z' });
    const critical = makeTask({ id: 'b', importance: 'high', urgency: 'high' }); // حرجة من كل الجهات
    const ranked = rankTasks([critical, soonDeadline], now);
    // الأهمية+الإلحاح معًا (6) أقوى من deadline يوم (3) — الأولوية للحرجة
    expect(ranked[0].task.id).toBe('b');
  });

  it('المهام المكتملة لا تظهر في التصنيف', () => {
    const done = makeTask({ id: 'x', status: 'done', importance: 'high', urgency: 'high' });
    const active = makeTask({ id: 'y', importance: 'low', urgency: 'low' });
    const ranked = rankTasks([done, active], now);
    expect(ranked.map((r) => r.task.id)).not.toContain('x');
  });

  it('getTopPriorities يرجّع العدد المطلوب', () => {
    const tasks = Array.from({ length: 5 }, (_, i) =>
      makeTask({ id: `t${i}`, importance: i % 2 ? 'high' : 'low', urgency: 'high' })
    );
    const top = getTopPriorities(tasks, 3, now);
    expect(top).toHaveLength(3);
  });
});

// ===== Suggestion Engine =====

describe('SuggestionEngine', () => {
  it('عند توفر 30 دقيقة يعرض مهمة تحتاج 30 دقيقة', () => {
    const task = makeTask({ id: 'a', estimatedDuration: 30, importance: 'high', urgency: 'high' });
    const result = suggestTask([task], { availableMinutes: 30 });
    expect(result.task?.id).toBe('a');
    expect(result.task).not.toBeNull();
  });

  it('لا يوجد وقت كافٍ لأي شيء → رسالة لطيفة بلا اقتراح', () => {
    const task = makeTask({ id: 'a', estimatedDuration: 60 });
    const result = suggestTask([task], { availableMinutes: 15 });
    expect(result.task).toBeNull();
    expect(result.reason).toContain('لا توجد مهمة');
  });

  it('طاقة منخفضة تفضّل مهمة خفيفة على ثقيلة', () => {
    const heavy = makeTask({ id: 'h', estimatedDuration: 30, importance: 'high', urgency: 'high', energyRequired: 'high' });
    const light = makeTask({ id: 'l', estimatedDuration: 20, importance: 'high', urgency: 'high', energyRequired: 'low' });
    const result = suggestTask([heavy, light], { availableMinutes: 30, energy: 'low' });
    expect(result.task?.id).toBe('l');
  });
});

// ===== Recovery Engine =====

describe('RecoveryEngine', () => {
  const now = '2026-01-10T10:00:00.000Z'; // السبت

  it('يوزّع المهام المتبقية على أيام قادمة', () => {
    const tasks: TaskRecord[] = [
      makeTask({ id: 'a', estimatedDuration: 40 }),
      makeTask({ id: 'b', estimatedDuration: 50 })
    ];
    const plan = recomputePlan({ tasks, startFrom: now, days: 5, maxMinutesPerDay: 360 });
    expect(plan.moved.length).toBe(2);
    expect(plan.untouched.length).toBe(0);
    // كلها بعد تاريخ البداية
    for (const m of plan.moved) {
      expect(m.scheduledAt > now).toBe(true);
    }
  });

  it('لا يتجاوز السقف اليومي', () => {
    const tasks: TaskRecord[] = [
      makeTask({ id: 'a', estimatedDuration: 300 }),
      makeTask({ id: 'b', estimatedDuration: 300 })
    ];
    const plan = recomputePlan({ tasks, startFrom: now, days: 2, maxMinutesPerDay: 360 });
    // كلاهما يجب أن يُجدولا في يومين متتاليين بلا تراكم فوق 360
    const dayCounts = new Map<string, number>();
    for (const m of plan.moved) {
      const day = m.scheduledAt.slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
    // لا يمكن وضع المهمتين في نفس اليوم (600 > 360)
    expect(dayCounts.size).toBeGreaterThanOrEqual(2);
  });

  it('الأحداث الثابتة لا تتحرك أبدًا ومدتها تُخصم من السعة', () => {
    const fixed: CalendarEvent = {
      id: 'f',
      title: 'محاضرة جامعية',
      kind: 'fixed',
      start: '2026-01-11T08:00:00.000Z',
      end: '2026-01-11T10:00:00.000Z',
      createdAt: now,
      updatedAt: now
    };
    // لو كان اليوم التالي مليئًا بحدث ثابت 120 دقيقة، مع سقف 360
    // تبقى السعة 240، فمهمة 300 لن توضع فيه بل تؤجل لليوم التالي
    const tasks: TaskRecord[] = [makeTask({ id: 'a', estimatedDuration: 300 })];
    const plan = recomputePlan({
      tasks,
      startFrom: now,
      days: 3,
      maxMinutesPerDay: 360,
      fixedEvents: [fixed]
    });
    // يجب ألا توضع في نفس يوم الحدث الثابت
    expect(plan.moved[0]?.scheduledAt.slice(0, 10)).not.toBe('2026-01-11');
  });

  it('رسالة لطيفة بدون جلد الذات', () => {
    const plan = recomputePlan({ tasks: [makeTask({ id: 'a' })], startFrom: now, days: 2 });
    expect(plan.message).toBeTruthy();
    expect(plan.message.toLowerCase()).not.toContain('fail');
    expect(plan.message.toLowerCase()).not.toContain('متأخر');
  });
});