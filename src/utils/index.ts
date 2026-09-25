// ============================================================
// رِفق — أدوات عامة
// ============================================================

/** مولّد معرّفات بسيط وفريد في البيئة */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** تاريخ ISO الآن */
export function nowISO(): string {
  return new Date().toISOString();
}

export { formatMinutesArabic } from './format';

/** مفتاح التاريخ المحلي (YYYY-MM-DD) — صحيح لتطبيق شخصي local-first */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

