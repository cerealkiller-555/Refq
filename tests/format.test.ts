// ============================================================
// رِفق — اختبارات تنسيق المدد بالعربية (ساعات ودقائق)
// "35 دقيقة"، "دقيقة واحدة"، "دقيقتين"، "ساعة و15 دقيقة"، "ساعتين"
// ============================================================

import { describe, it, expect } from 'vitest';
import { formatMinutesArabic } from '../src/utils';

describe('formatMinutesArabic', () => {
  it('الدقائق فقط — بقواعد العربية السليمة', () => {
    expect(formatMinutesArabic(35)).toBe('35 دقيقة');
    expect(formatMinutesArabic(1)).toBe('دقيقة واحدة');
    expect(formatMinutesArabic(2)).toBe('دقيقتين');
    expect(formatMinutesArabic(5)).toBe('5 دقائق');
    expect(formatMinutesArabic(10)).toBe('10 دقائق');
    expect(formatMinutesArabic(11)).toBe('11 دقيقة');
    expect(formatMinutesArabic(59)).toBe('59 دقيقة');
  });

  it('ساعات كاملة', () => {
    expect(formatMinutesArabic(60)).toBe('ساعة');
    expect(formatMinutesArabic(120)).toBe('ساعتين');
    expect(formatMinutesArabic(180)).toBe('3 ساعات');
    expect(formatMinutesArabic(600)).toBe('10 ساعات');
    expect(formatMinutesArabic(660)).toBe('11 ساعة');
  });

  it('ساعات ودقائق معًا — كما طلبت المستخدمة', () => {
    expect(formatMinutesArabic(75)).toBe('ساعة و15 دقيقة');
    expect(formatMinutesArabic(90)).toBe('ساعة و30 دقيقة');
    expect(formatMinutesArabic(135)).toBe('ساعتين و15 دقيقة');
    expect(formatMinutesArabic(205)).toBe('3 ساعات و25 دقيقة');
  });

  it('القيم الحدية آمنة — بلا انهيار', () => {
    expect(formatMinutesArabic(0)).toBe('أقل من دقيقة');
    expect(formatMinutesArabic(-5)).toBe('أقل من دقيقة');
    expect(formatMinutesArabic(Number.NaN)).toBe('أقل من دقيقة');
  });
});