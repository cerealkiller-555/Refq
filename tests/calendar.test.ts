import { describe, expect, it } from 'vitest';
import { expandEvents, eventsForDay, eventsForWeek } from '../src/core/engines/calendarEngine';
import type { CalendarEvent } from '../src/core/types';

const base: CalendarEvent = {
  id: 'event-1',
  title: 'قراءة',
  kind: 'flexible',
  start: '2026-09-01T09:00:00.000Z',
  end: '2026-09-01T09:30:00.000Z',
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z'
};

describe('CalendarEngine', () => {
  it('يوّسع الحدث اليومي حتى until', () => {
    const event = { ...base, recurring: { freq: 'daily' as const, until: '2026-09-03T23:59:59.000Z' } };
    const result = expandEvents([event], '2026-09-01T00:00:00.000Z', '2026-09-05T00:00:00.000Z');
    expect(result).toHaveLength(3);
    expect(result.map((item) => item.start.slice(0, 10))).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });

  it('يوّسع الحدث الأسبوعي في نفس يوم الأسبوع', () => {
    const event = { ...base, recurring: { freq: 'weekly' as const, until: '2026-09-22T23:59:59.000Z' } };
    const result = expandEvents([event], '2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
    expect(result).toHaveLength(4);
  });

  it('يفصل أحداث اليوم عن الأسبوع', () => {
    const recurring = { ...base, recurring: { freq: 'daily' as const, until: '2026-09-04T23:59:59.000Z' } };
    expect(eventsForDay([recurring], '2026-09-03')).toHaveLength(1);
    expect(eventsForWeek([recurring], '2026-08-29')).toHaveLength(4);
  });

  it('يعيد الأحداث غير المتكررة التي تتقاطع مع النطاق', () => {
    const result = expandEvents([base], '2026-09-01T09:15:00.000Z', '2026-09-01T10:00:00.000Z');
    expect(result).toHaveLength(1);
  });
});
