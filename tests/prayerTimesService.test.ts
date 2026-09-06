// ============================================================
// رِفق — اختبارات خدمة مواقيت الصلاة (P3)
// تحويل استجابة Aladhan إلى مراسٍ (source:'service') مرتبطة بالتاريخ
// + سلوك الفشل/الاستجابة غير الصالحة
// ============================================================

import { describe, it, expect } from 'vitest';
import { fetchPrayerAnchors, type Fetcher } from '../src/core/services/prayerTimesService';

function okResponse(): Fetcher {
  return async () => ({
    ok: true,
    json: async () => ({
      code: 200,
      data: {
        timings: {
          Fajr: '05:07',
          Dhuhr: '12:53',
          Asr: '16:26',
          Maghrib: '19:09',
          Isha: '20:28'
        }
      }
    })
  });
}

describe('PrayerTimesService', () => {
  it('يحوّل استجابة Aladhan إلى 5 مراسٍ source:service مرتبطة بتاريخ اليوم', async () => {
    const anchors = await fetchPrayerAnchors({ dateKey: '2026-09-08', lat: 30, lon: 31 }, okResponse());
    expect(anchors).toHaveLength(5);
    expect(anchors.map((a) => a.prayer).sort()).toEqual(['asr', 'dhuhr', 'fajr', 'isha', 'maghrib']);
    for (const a of anchors) {
      expect(a.date).toBe('2026-09-08');
      expect(a.source).toBe('service');
      expect(a.time).toBeTruthy();
    }
    // الفجر 05:07
    expect(new Date(anchors.find((a) => a.prayer === 'fajr')!.time).getHours()).toBe(5);
    expect(new Date(anchors.find((a) => a.prayer === 'fajr')!.time).getMinutes()).toBe(7);
  });

  it('الاستجابة الفاشلة (ok:false) ترمي خطأ', async () => {
    const failing: Fetcher = async () => ({ ok: false, json: async () => ({}) });
    await expect(fetchPrayerAnchors({ dateKey: '2026-09-08', lat: 30, lon: 31 }, failing)).rejects.toThrow();
  });

  it('استجابة بدون timings أو code != 200 ترمي خطأ', async () => {
    const bad: Fetcher = async () => ({ ok: true, json: async () => ({ code: 404, data: null }) });
    await expect(fetchPrayerAnchors({ dateKey: '2026-09-08', lat: 30, lon: 31 }, bad)).rejects.toThrow();
  });

  it('غياب موعد صلاة من الاستجابة يرمي خطأ (وليس صمتًا لوقت خاطئ)', async () => {
    const missing: Fetcher = async () => ({
      ok: true,
      json: async () => ({ code: 200, data: { timings: { Fajr: '05:07' } } })
    });
    await expect(fetchPrayerAnchors({ dateKey: '2026-09-08', lat: 30, lon: 31 }, missing)).rejects.toThrow();
  });
});