// ============================================================
// رِفق — محرك التقويم (Calendar Engine) — دوال نقية خالصة
// توسيع الأحداث المتكررة + تصفية باليوم/الأسبوع بتواريخ محلية
// بلا UI، بلا Dexie، بلا side effects — قابل للاختبار تمامًا
// ============================================================

import type { CalendarEvent } from '../types';

/** حدوث فعلي لحدث (للأحداث المتكررة يختلف عن event.start الأصلي) */
export interface EventOccurrence {
  event: CalendarEvent;
  start: string; // ISO
  end: string; // ISO
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** سقف أمان لتفادي حلقة لا نهائية مع بيانات تكرار غير سليمة */
const MAX_EXPANSION = 400;

/** مفتاح تاريخ محلي YYYY-MM-DD (مستقل عن المنطقة الزمنية) */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** إضافة أيام لمفتاح تاريخ محلي وإرجاع مفتاح جديد */
export function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** بداية اليوم المحلي ونهايته كـ ISO */
function dayWindow(dateKeyStr: string): { from: string; to: string } {
  const startMs = new Date(`${dateKeyStr}T00:00:00`).getTime();
  return {
    from: new Date(startMs).toISOString(),
    to: new Date(startMs + DAY_MS).toISOString()
  };
}

/** هل يتقاطع [start,end) مع [from,to)؟ */
function overlaps(start: string, end: string, from: string, to: string): boolean {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const f = new Date(from).getTime();
  const t = new Date(to).getTime();
  return s < t && e > f;
}

/**
 * توسيع حدث واحد إلى حدوثات ضمن [from, to) (بالتراكب).
 * الأحداث المتكررة (daily/weekly + until اختياري) تُمدد بخطوة ثابتة.
 * الأحداث غير المتكررة تُعاد كما هي إن تراكبت فقط.
 */
export function expandEvent(event: CalendarEvent, from: string, to: string): EventOccurrence[] {
  const durationMs = Math.max(0, new Date(event.end).getTime() - new Date(event.start).getTime());
  const occurrences: EventOccurrence[] = [];

  if (!event.recurring) {
    if (overlaps(event.start, event.end, from, to)) {
      occurrences.push({ event, start: event.start, end: event.end });
    }
    return occurrences;
  }

  const stepDays = event.recurring.freq === 'daily' ? 1 : 7;
  const untilMs = event.recurring.until ? new Date(event.recurring.until).getTime() : null;
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();

  // نبني بداية الحدوث الأول: نرجع للخلف حتى نضمن تغطية from (حدث بدأ قبل النطاق وقد يمتد إليه)
  let startMs = new Date(event.start).getTime();
  let guard = 0;
  while (startMs + durationMs <= fromMs && guard < MAX_EXPANSION) {
    startMs += stepDays * DAY_MS;
    guard += 1;
  }

  guard = 0;
  while (startMs < toMs && guard < MAX_EXPANSION) {
    if (untilMs !== null && startMs > untilMs) break;
    const endMs = startMs + durationMs;
    if (overlaps(new Date(startMs).toISOString(), new Date(endMs).toISOString(), from, to)) {
      occurrences.push({
        event,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString()
      });
    }
    startMs += stepDays * DAY_MS;
    guard += 1;
  }

  return occurrences;
}

/** توسيع قائمة أحداث وترتيبها زمنيًا ضمن نطاق */
export function expandEvents(events: CalendarEvent[], from: string, to: string): EventOccurrence[] {
  const all: EventOccurrence[] = [];
  for (const event of events) all.push(...expandEvent(event, from, to));
  return all.sort((a, b) => a.start.localeCompare(b.start) || a.event.id.localeCompare(b.event.id));
}

/** أحداث يوم محلي معين (بالتراكب — حدث ممتد من أمس يظهر اليوم) */
export function eventsForDay(events: CalendarEvent[], dateKeyStr: string): EventOccurrence[] {
  const { from, to } = dayWindow(dateKeyStr);
  return expandEvents(events, from, to);
}

/** أيام الأسبوع (7 مفاتيح) بدءًا من يوم بداية الأسبوع المحدد */
export function weekDayKeys(weekStartKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysKey(weekStartKey, i));
}

/** تجميع أحداث أسبوع (7 أيام تبدأ من weekStartKey) — مفتاح اليوم ← حدوثاته */
export function eventsForWeek(
  events: CalendarEvent[],
  weekStartKey: string
): Map<string, EventOccurrence[]> {
  const days = weekDayKeys(weekStartKey);
  const from = new Date(`${days[0]}T00:00:00`).toISOString();
  const to = new Date(`${addDaysKey(days[6], 1)}T00:00:00`).toISOString();
  const occurrences = expandEvents(events, from, to);

  const byDay = new Map<string, EventOccurrence[]>(days.map((d) => [d, []]));
  for (const occ of occurrences) {
    // الحدث يُدرج في كل يوم محلي يتقاطع معه
    let cursor = new Date(occ.start);
    const endMs = new Date(occ.end).getTime();
    let guard = 0;
    while (cursor.getTime() < endMs && guard < 31) {
      const key = dateKey(cursor);
      if (byDay.has(key)) byDay.get(key)!.push(occ);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      guard += 1;
    }
  }
  return byDay;
}

/** تنسيق وقت الحدث للعرض — "09:00–10:30" (بلا تواريخ مطلقة) */
export function formatEventTime(start: string, end: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  return `${fmt(start)}–${fmt(end)}`;
}

/** تحويل مفتاح تاريخ + وقت HH:MM محلي إلى ISO */
export function localDateTimeISO(dateKeyStr: string, time: string): string {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  const d = new Date(`${dateKeyStr}T00:00:00`);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d.toISOString();
}

/** مفتاح اليوم المحلي الحالي — مساعد شائع للـUI والاختبارات */
export function todayKey(): string {
  return dateKey(new Date());
}