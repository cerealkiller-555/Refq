// ============================================================
// رِفق — محرك فترات اليوم (Day Periods / Prayer Anchors)
// الصلوات هي العلامات الطبيعية لليوم:
//   الفجر → الظهر → العصر → المغرب → العشاء
// كل فترة مساحة زمنية مستقلة نسبيًا للتخطيط والاقتراح.
// دالات نقية — بلا UI، بلا جلب مواقيت، بلا استنتاجات.
// المراسي لا تُحرك أبدًا (تُمرر لاحقًا في P2 كأحداث ثابتة).
// ============================================================

import type { DayPeriod, PrayerAnchor, PrayerKey } from '../types';

export const PRAYER_ORDER: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const PRAYER_LABELS: Record<PrayerKey, string> = {
  fajr: 'الفجر',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء'
};

function minutesUntil(targetISO: string, nowISO: string): number {
  const diff = (new Date(targetISO).getTime() - new Date(nowISO).getTime()) / 60000;
  return Math.max(0, Math.floor(diff));
}

/** كل فترات اليوم مرتبة: ليل قبل أول مرساة، ثم بين المراسي، ثم ليل مفتوح */
export function getDayPeriods(anchors: PrayerAnchor[], now: string): DayPeriod[] {
  const sorted = [...anchors].sort((a, b) => a.time.localeCompare(b.time));
  if (sorted.length === 0) return [];

  const periods: DayPeriod[] = [];

  // ليل قبل أول مرساة — ينتهي بالمرساة الأولى
  periods.push({
    anchor: 'night',
    start: null,
    end: sorted[0].time,
    remainingMinutes: minutesUntil(sorted[0].time, now)
  });

  // فترات بين المراسي المتتالية
  for (let i = 0; i < sorted.length - 1; i++) {
    periods.push({
      anchor: sorted[i].prayer,
      start: sorted[i].time,
      end: sorted[i + 1].time,
      remainingMinutes: minutesUntil(sorted[i + 1].time, now)
    });
  }

  // ليل بعد آخر مرساة — مفتوح بلا سقف عملي
  periods.push({
    anchor: 'night',
    start: sorted[sorted.length - 1].time,
    end: null,
    remainingMinutes: null
  });

  return periods;
}

export interface CurrentPeriod {
  period: DayPeriod;
  /** المرساة القادمة (للاستخدام في أسباب الاقتراح فقط) */
  nextAnchor?: PrayerAnchor;
}

/**
 * الفترة الحالية الآن — null إن لم توجد مراسي (ويعمل التطبيق كالعادة).
 * الفترة تمتد من مرساة إلى المرساة التالية؛ خارجها يُعد ليلًا.
 */
export function getCurrentPeriod(anchors: PrayerAnchor[], now: string): CurrentPeriod | null {
  const sorted = [...anchors].sort((a, b) => a.time.localeCompare(b.time));
  if (sorted.length === 0) return null;
  const nowMs = new Date(now).getTime();

  // قبل أول مرساة — ليل ينتهي بها
  if (nowMs < new Date(sorted[0].time).getTime()) {
    return {
      period: {
        anchor: 'night',
        start: null,
        end: sorted[0].time,
        remainingMinutes: minutesUntil(sorted[0].time, now)
      },
      nextAnchor: sorted[0]
    };
  }

  // بين مرساة والتي تليها
  for (let i = 0; i < sorted.length - 1; i++) {
    const startMs = new Date(sorted[i].time).getTime();
    const endMs = new Date(sorted[i + 1].time).getTime();
    if (nowMs >= startMs && nowMs < endMs) {
      return {
        period: {
          anchor: sorted[i].prayer,
          start: sorted[i].time,
          end: sorted[i + 1].time,
          remainingMinutes: minutesUntil(sorted[i + 1].time, now)
        },
        nextAnchor: sorted[i + 1]
      };
    }
  }

  // بعد آخر مرساة — ليل مفتوح
  const last = sorted[sorted.length - 1];
  return {
    period: { anchor: 'night', start: last.time, end: null, remainingMinutes: null },
    nextAnchor: undefined
  };
}