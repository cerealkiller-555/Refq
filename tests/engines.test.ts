// ============================================================
// رِفق — اختبارات المحركات (P0.4)
// Priority · Suggestion · Recovery
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  rankTasks,
  getTopPriorities,
  describeReason
} from '../src/core/engines/priorityEngine';
import { suggestTask } from '../src/core/engines/suggestionEngine';
import { recomputePlan } from '../src/core/engines/recoveryEngine';
import { getCurrentPeriod, getDayPeriods } from '../src/core/engines/dayPeriods';
import type { TaskRecord, CalendarEvent, PrayerAnchor } from '../src/core/types';

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

// ===== P1 — Priority: أسباب، تعادل، طاقة =====

describe('PriorityEngine P1', () => {
  const now = '2026-01-10T10:00:00.000Z';

  it('أهمية أعلى تتقدم عند تساوي باقي الظروف', () => {
    const high = makeTask({ id: 'a', importance: 'high' });
    const low = makeTask({ id: 'b', importance: 'low' });
    const ranked = rankTasks([low, high], now);
    expect(ranked[0].task.id).toBe('a');
  });

  it('التعادل يُحسم بالموعد الأقرب ثم الأقدم إنشاءً', () => {
    const early = makeTask({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' });
    const late = makeTask({ id: 'b', createdAt: '2026-01-02T00:00:00.000Z' });
    const ranked = rankTasks([late, early], now);
    expect(ranked[0].task.id).toBe('a');
  });

    it('التعادل التام يُحسم بـid (استقرار كامل)', () => {
    // نفس createdAt عشان يتعادل الترتيب بالكامل وينتهي بالمعرف فقط (مستقر تمامًا)
    const ts = '2026-01-10T00:00:00.000Z';
    const b = makeTask({ id: 'b', createdAt: ts });
    const a = makeTask({ id: 'a', createdAt: ts });
    const ranked = rankTasks([b, a], now);
    expect(ranked[0].task.id).toBe('a');
  });

  it('الطاقة المنخفضة تنزل أولوية المهمة العميقة', () => {
    const deep = makeTask({ id: 'deep', importance: 'high', urgency: 'high', energyRequired: 'high' });
    const normal = makeTask({ id: 'normal', importance: 'high', urgency: 'high' });
    const ranked = rankTasks([deep, normal], now, 'low');
    expect(ranked[0].task.id).toBe('normal');
  });

  it('السبب يذكر الموعد والأهمية بدون أي أرقام', () => {
    const task = makeTask({ importance: 'high', deadline: '2026-01-12T10:00:00.000Z' });
    const reason = describeReason(task, now);
    expect(reason).toContain('الموعد قريب');
    expect(reason).toContain('المهمة مهمة');
    expect(reason).not.toMatch(/\d/);
  });

  it('السبب الافتراضي لطيف وبلا أرقام', () => {
    expect(describeReason(makeTask({}), now)).toBe('ضمن مهام يومك بهدوء');
  });
});

// ===== P1 — Suggestion: يوم خفيف وفترات الصلوات =====

describe('SuggestionEngine P1', () => {
  const now = '2026-01-10T10:00:00.000Z';

  it('wantsLightDay يستبعد الثقيلة ويقترح الخفيفة', () => {
    const heavy = makeTask({ id: 'h', estimatedDuration: 90, energyRequired: 'high', importance: 'high', urgency: 'high' });
    const light = makeTask({ id: 'l', estimatedDuration: 20 });
    const result = suggestTask([heavy, light], { availableMinutes: 120, wantsLightDay: true, now });
    expect(result.task?.id).toBe('l');
  });

  it('يوم خفيف بلا مهام خفيفة → لا اقتراح مع رسالة مطمئنة', () => {
    const heavy = makeTask({ id: 'h', estimatedDuration: 90 });
    const result = suggestTask([heavy], { availableMinutes: 120, wantsLightDay: true, now });
    expect(result.task).toBeNull();
    expect(result.reason).toContain('يومًا خفيفًا');
  });

  it('فترة الصلوات: مهمة 60 دقيقة لا تُقترح إذا بقي 35 دقيقة فقط', () => {
    const task = makeTask({ id: 'long', estimatedDuration: 60 });
    const result = suggestTask([task], {
      availableMinutes: 60,
      period: { remainingMinutes: 35, nextAnchorLabel: 'المغرب' },
      now
    });
    expect(result.task).toBeNull();
    expect(result.reason).toContain('المغرب');
  });

  it('فترة الصلوات: مهمة 30 دقيقة تُقترح والسبب يذكر المرساة القادمة', () => {
    const task = makeTask({ id: 'short', estimatedDuration: 30, importance: 'high' });
    const result = suggestTask([task], {
      availableMinutes: 60,
      period: { remainingMinutes: 35, nextAnchorLabel: 'المغرب' },
      now
    });
    expect(result.task?.id).toBe('short');
    expect(result.reason).toContain('قبل المغرب');
  });

  it('ليل مفتوح (remainingMinutes = null) لا يقيّد الاقتراح', () => {
    const task = makeTask({ id: 'night', estimatedDuration: 90 });
    const result = suggestTask([task], {
      availableMinutes: 90,
      period: { remainingMinutes: null, nextAnchorLabel: 'الفجر' },
      now
    });
    expect(result.task?.id).toBe('night');
  });
});

// ===== P1 — DayPeriods: مراسي الصلوات =====

describe('DayPeriods', () => {
  const day = '2026-01-10';
  const anchors: PrayerAnchor[] = [
    { id: 'p-fajr', date: day, prayer: 'fajr', time: '2026-01-10T05:00:00.000Z', source: 'manual', createdAt: '', updatedAt: '' },
    { id: 'p-dhuhr', date: day, prayer: 'dhuhr', time: '2026-01-10T09:00:00.000Z', source: 'manual', createdAt: '', updatedAt: '' },
    { id: 'p-asr', date: day, prayer: 'asr', time: '2026-01-10T12:00:00.000Z', source: 'manual', createdAt: '', updatedAt: '' },
    { id: 'p-maghrib', date: day, prayer: 'maghrib', time: '2026-01-10T14:30:00.000Z', source: 'manual', createdAt: '', updatedAt: '' },
    { id: 'p-isha', date: day, prayer: 'isha', time: '2026-01-10T16:00:00.000Z', source: 'manual', createdAt: '', updatedAt: '' }
  ];

  it('الفترة الحالية بين العصر والمغرب تعيد المتبقي الصحيح', () => {
    const current = getCurrentPeriod(anchors, '2026-01-10T13:25:00.000Z');
    expect(current).not.toBeNull();
    expect(current?.period.anchor).toBe('asr');
    expect(current?.nextAnchor?.prayer).toBe('maghrib');
    expect(current?.period.remainingMinutes).toBe(65);
  });

  it('قبل الفجر = ليل ينتهي بالفجر', () => {
    const current = getCurrentPeriod(anchors, '2026-01-10T03:00:00.000Z');
    expect(current?.period.anchor).toBe('night');
    expect(current?.nextAnchor?.prayer).toBe('fajr');
    expect(current?.period.remainingMinutes).toBe(120);
  });

  it('بعد العشاء = ليل مفتوح بلا سقف', () => {
    const current = getCurrentPeriod(anchors, '2026-01-10T20:00:00.000Z');
    expect(current?.period.anchor).toBe('night');
    expect(current?.period.remainingMinutes).toBeNull();
    expect(current?.nextAnchor).toBeUndefined();
  });

  it('عند تمام وقت الصلاة تبدأ فترتها (المرساة لا تُحرك)', () => {
    const current = getCurrentPeriod(anchors, '2026-01-10T09:00:00.000Z');
    expect(current?.period.anchor).toBe('dhuhr');
  });

  it('بلا مراسٍ → null والفترات فارغة (التطبيق يعمل كالعادة)', () => {
    expect(getCurrentPeriod([], '2026-01-10T10:00:00.000Z')).toBeNull();
    expect(getDayPeriods([], '2026-01-10T10:00:00.000Z')).toHaveLength(0);
  });

  it('خمس مراسٍ → 6 فترات (ليل قبل وبعد + 4 بين المراسي)', () => {
    const periods = getDayPeriods(anchors, '2026-01-10T10:00:00.000Z');
    expect(periods).toHaveLength(6);
  });
});

// ===== P1 — Recovery: مراسي الصلوات ثابتة =====

describe('RecoveryEngine P1', () => {
  const now = '2026-01-10T10:00:00.000Z';

  it('مراسي الصلوات (أحداث ثابتة) لا تدخل إعادة التوزيع وتُخصم سعتها فقط', () => {
    const prayer: CalendarEvent = {
      id: 'prayer-asr',
      title: 'صلاة العصر',
      kind: 'fixed',
      start: '2026-01-11T12:00:00.000Z',
      end: '2026-01-11T12:20:00.000Z',
      createdAt: now,
      updatedAt: now
    };
    const plan = recomputePlan({
      tasks: [makeTask({ id: 'a', estimatedDuration: 100 })],
      startFrom: now,
      days: 2,
      maxMinutesPerDay: 300,
      fixedEvents: [prayer]
    });
    // المراسي ليست مهامًا — لا تُحرك أبدًا
    expect(plan.moved.every((m) => m.taskId !== prayer.id)).toBe(true);
    // سعة يوم الصلاة = 300 - 20 = 280 → المهمة (100) تتسع فيه
    expect(plan.moved[0]?.scheduledAt.slice(0, 10)).toBe('2026-01-11');
  });
});