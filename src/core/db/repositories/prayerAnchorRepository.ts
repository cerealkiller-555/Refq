// ============================================================
// رِفق — Prayer Anchors Repository
// مراسي الصلوات ليوم محدد. لا استنتاج ولا جلب من خدمة هنا:
// يدوي الآن، ومن خدمة مواقيت لاحقًا (P2) — نفس الجدول نفس الواجهة.
// ============================================================

import { db } from '../schema';
import { BaseRepository } from './baseRepository';
import type { PrayerAnchor, PrayerKey } from '../../types';

class PrayerAnchorRepository extends BaseRepository<PrayerAnchor> {
  constructor() {
    super(db.prayerAnchors);
  }

  async getForDate(date: string): Promise<PrayerAnchor[]> {
    return this.table.where('date').equals(date).toArray();
  }

  /** إضافة/تحديث موعد صلاة ليوم (upsert لكل صلاة) */
  async upsert(
    date: string,
    prayer: PrayerKey,
    time: string,
    source: PrayerAnchor['source'] = 'manual'
  ): Promise<PrayerAnchor> {
    const existing = await this.table
      .where('date')
      .equals(date)
      .filter((a) => a.prayer === prayer)
      .first();
    if (existing) {
      return (await this.update(existing.id, { time, source })) as PrayerAnchor;
    }
    return this.create({ date, prayer, time, source } as PrayerAnchor);
  }

  async clearDate(date: string): Promise<void> {
    await this.table.where('date').equals(date).delete();
  }
}

export const prayerAnchorRepository = new PrayerAnchorRepository();