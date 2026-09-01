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

  async getByLinkedTask(linkedTaskId: string): Promise<CalendarEvent[]> {
    return this.table.where('linkedTaskId').equals(linkedTaskId).toArray();
  }

  async deleteByLinkedTaskId(linkedTaskId: string): Promise<void> {
    const events = await this.getByLinkedTask(linkedTaskId);
    await this.table.bulkDelete(events.map((event) => event.id));
  }
}

export const calendarRepository = new CalendarRepository();