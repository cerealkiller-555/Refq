// ============================================================
// رِفق — Google Calendar Cache Repository
// كاش محلي لأحداث تقويم جوجل (قراءة فقط). الجداول مستثناة من
// النسخ الاحتياطية: بيانات جوجل ملك Google وتُعاد مزامنتها دائمًا.
// ============================================================

import { db } from '../schema';
import { BaseRepository } from './baseRepository';
import type { CalendarEvent } from '../../types';

class GoogleCalendarRepository extends BaseRepository<CalendarEvent> {
  constructor() {
    super(db.googleEventsCache);
  }

  /**
   * استبدال الكاش بالكامل بنتائج مزامنة واحدة (ذرّية).
   * يعيد عدد الأحداث المخزّنة بعد الاستبدال.
   */
  async replaceAll(events: CalendarEvent[]): Promise<number> {
    await db.transaction('rw', db.googleEventsCache, async () => {
      await this.table.clear();
      if (events.length) await this.table.bulkPut(events);
    });
    return events.length;
  }

  /** أحداث تبدأ أو تمتد ضمن نطاق [from, to) */
  async getBetween(from: string, to: string): Promise<CalendarEvent[]> {
    return this.table
      .where('start')
      .between(from, to, true, false)
      .toArray();
  }

  async count(): Promise<number> {
    return this.table.count();
  }
}

export const googleCalendarRepository = new GoogleCalendarRepository();
