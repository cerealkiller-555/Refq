// ============================================================
// رِفق — تنسيق المدد الزمنية بالعربية (ساعات ودقائق)
// قواعد لغوية سليمة وبسيطة — بلا مكتبات خارجية.
// ============================================================

/** صياغة عدد الدقائق وحدها بالعربية (1–59) */
function minutesPart(m: number): string {
  if (m === 1) return 'دقيقة واحدة';
  if (m === 2) return 'دقيقتين';
  if (m <= 10) return `${m} دقائق`;
  return `${m} دقيقة`;
}

/** صياغة عدد الساعات وحدها */
function hoursPart(h: number): string {
  if (h === 1) return 'ساعة';
  if (h === 2) return 'ساعتين';
  if (h <= 10) return `${h} ساعات`;
  return `${h} ساعة`;
}

/**
 * صياغة مدة بالدقائق بالعربية: "35 دقيقة"، "ساعة و15 دقيقة"، "ساعتين"، "3 ساعات و10 دقائق".
 * مدخلات سالبة أو غير محدودة تعيد نصًا آمنًا — بلا انهيار أبدًا.
 */
export function formatMinutesArabic(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 1) return 'أقل من دقيقة';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return minutesPart(minutes);
  if (minutes === 0) return hoursPart(hours);
  return `${hoursPart(hours)} و${minutesPart(minutes)}`;
}