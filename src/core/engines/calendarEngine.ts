import type { CalendarEvent } from '../types';

/**
 * Calendar calculations are intentionally pure and use local calendar dates.
 * This avoids shifting an event to another day when the user's timezone differs
 * from the machine that created the ISO timestamp.
 */

function localDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function localStartOfDay(value: string | Date): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function occurrenceForDay(event: CalendarEvent, day: Date): CalendarEvent {
  const originalStart = new Date(event.start);
  const originalEnd = new Date(event.end);
  const duration = Math.max(0, originalEnd.getTime() - originalStart.getTime());
  const start = new Date(day);
  start.setHours(
    originalStart.getHours(),
    originalStart.getMinutes(),
    originalStart.getSeconds(),
    originalStart.getMilliseconds()
  );
  const end = new Date(start.getTime() + duration);

  return {
    ...event,
    id: `${event.id}:${localDateKey(start)}`,
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function recurrenceDates(event: CalendarEvent, from: Date, to: Date): Date[] {
  const recurrence = event.recurring;
  if (!recurrence) return [];

  const first = localStartOfDay(event.start);
  const until = recurrence.until ? new Date(recurrence.until) : null;
  const dates: Date[] = [];

  if (recurrence.freq === 'daily') {
    for (let day = first; day < to; day = addLocalDays(day, 1)) {
      if (day >= from && (!until || day <= until)) dates.push(day);
    }
    return dates;
  }

  const targetWeekday = first.getDay();
  for (let day = first; day < to; day = addLocalDays(day, 1)) {
    if (day.getDay() === targetWeekday && day >= from && (!until || day <= until)) {
      dates.push(day);
    }
  }
  return dates;
}

/** Expand daily/weekly events into concrete occurrences intersecting [from, to). */
export function expandEvents(events: CalendarEvent[], from: string | Date, to: string | Date): CalendarEvent[] {
  const rangeStart = new Date(from);
  const rangeEnd = new Date(to);
  const expanded: CalendarEvent[] = [];

  for (const event of events) {
    if (!event.recurring) {
      const start = new Date(event.start);
      const end = new Date(event.end);
      if (start < rangeEnd && end > rangeStart) expanded.push(event);
      continue;
    }

    for (const day of recurrenceDates(event, localStartOfDay(rangeStart), rangeEnd)) {
      const occurrence = occurrenceForDay(event, day);
      const start = new Date(occurrence.start);
      const end = new Date(occurrence.end);
      if (start < rangeEnd && end > rangeStart) expanded.push(occurrence);
    }
  }

  return expanded.sort((a, b) => a.start.localeCompare(b.start));
}

/** Return events whose occurrence starts on the supplied local calendar date. */
export function eventsForDay(events: CalendarEvent[], date: string | Date): CalendarEvent[] {
  const day = localStartOfDay(date);
  const next = addLocalDays(day, 1);
  return expandEvents(events, day, next).filter((event) => localDateKey(event.start) === localDateKey(day));
}

/** Return all event occurrences starting on one of the seven local dates. */
export function eventsForWeek(events: CalendarEvent[], weekStart: string | Date): CalendarEvent[] {
  const start = localStartOfDay(weekStart);
  const end = addLocalDays(start, 7);
  return expandEvents(events, start, end).filter((event) => {
    const key = localDateKey(event.start);
    return key >= localDateKey(start) && key < localDateKey(end);
  });
}
