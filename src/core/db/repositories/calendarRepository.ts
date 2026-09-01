// ============================================================
// رِفق — Calendar Repository
// ============================================================

import { db } from '../schema';
import { BaseRepository } from './baseRepository';
import type { CalendarEvent } from '../../types';

class CalendarRepository extends BaseRepository<CalendarEvent> {
  constructor() {
    super(db.calendarEvents);
  }

  /** أحداث تبدأ أو تمتد ضمن نطاق [from, to) */
  async getBetween(from: string, to: string): Promise<CalendarEvent[]> {
    return this.table
      .where('start')
      .between(from, to, true, false)
      .toArray();
  }

  async getByKind(kind: CalendarEvent['kind']): Promise<CalendarEvent[]> {
    return this.table.where('kind').equals(kind).toArray();
  }

  async getFixed(): Promise<CalendarEvent[]> {
    return this.table.where('kind').equals('fixed').toArray();
  }

  async getFlexible(): Promise<CalendarEvent[]> {
    return this.table.where('kind').equals('flexible').toArray();
  }

  /** أحداث مربوطة بمهمة معينة (مُنشأة بالجدولة أو إعادة التوزيع) */
  async getByLinkedTask(taskId: string): Promise<CalendarEvent[]> {
    return this.table.where('linkedTaskId').equals(taskId).toArray();
  }

  /** حذف كل الأحداث المرنة المربوطة بمهمة (تحرير المساحة بلطف عند الإنجاز) */
  async deleteFlexibleByLinkedTask(taskId: string): Promise<void> {
    const linked = await this.getByLinkedTask(taskId);
    const flexibleIds = linked.filter((e) => e.kind === 'flexible').map((e) => e.id);
    if (flexibleIds.length) await this.table.bulkDelete(flexibleIds);
  }
}

export const calendarRepository = new CalendarRepository();