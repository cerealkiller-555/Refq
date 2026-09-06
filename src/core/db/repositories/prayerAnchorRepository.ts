// ============================================================
// رِفق — Prayer Anchors Repository
// مراسي الصلوات ليوم محدد. لا استنتاج ولا جلب من خدمة هنا:
// يدوي الآن، ومن خدمة مواقيت لاحقًا (P2) — نفس الجدول نفس الواجهة.
// ============================================================

import { db } from '../schema';
import { BaseRepository } from './baseRepository';
import { generateId, nowISO } from '../../../utils';
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

  /**
   * استبدال مراسي يوم كامل بجديدة (تُستخدم للجلب التلقائي؛ كلها source:'service').
   * لا تحذف/تعدّل من الـUI أبدًا — الصلاة لا تُحرَّك ولا تُحذف.
   */
  async replaceForDate(date: string, anchors: Array<Omit<PrayerAnchor, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PrayerAnchor[]> {
    await this.table.where('date').equals(date).delete();
    const records: PrayerAnchor[] = anchors.map((anchor) => ({
      ...anchor,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO()
    }));
    await this.table.bulkPut(records);
    return records;
  }
}

export const prayerAnchorRepository = new PrayerAnchorRepository();