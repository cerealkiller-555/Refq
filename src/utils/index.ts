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

/** تاريخ ISO لتاريخ اليوم فقط (YYYY-MM-DD) */
export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** إضافة أيام لتاريخ معيّن وإرجاع ISO */
export function addDaysISO(date: string | Date, days: number): string {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** تنظيف نص — إزالة فراغات زائدة */
export function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}