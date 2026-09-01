// ============================================================
// رِفق — Task Repository
// ============================================================

import { db } from '../schema';
import { BaseRepository } from './baseRepository';
import type { TaskRecord } from '../../types';

class TaskRepository extends BaseRepository<TaskRecord> {
  constructor() {
    super(db.tasks);
  }

  /** المهام المفتوحة مرتبة حسب الموعد أو المدة */
  async getOpenTasks(): Promise<TaskRecord[]> {
    return this.table
      .where('status')
      .anyOf('todo', 'in_progress')
      .toArray();
  }

  async getByStatus(status: TaskRecord['status']): Promise<TaskRecord[]> {
    return this.table.where('status').equals(status).toArray();
  }

  /** المهام المفتوحة بموعد محدد (اليوم جمعة) */
  async getOpenScheduled(scheduledAt: string): Promise<TaskRecord[]> {
    return this.table
      .where('scheduledAt')
      .equals(scheduledAt)
      .filter((t) => t.status !== 'done')
      .toArray();
  }

  async getByPathItem(itemId: string): Promise<TaskRecord[]> {
    return this.table.where('linkedPathItemId').equals(itemId).toArray();
  }

  async markDone(id: string): Promise<TaskRecord | undefined> {
    return this.update(id, { status: 'done' });
  }

  /** إنجاز مهمة — تسمية أوضح للاستخدام في الـstores والـUI */
  async complete(id: string): Promise<TaskRecord | undefined> {
    return this.update(id, { status: 'done' });
  }

  async setScheduled(id: string, scheduledAt: string): Promise<TaskRecord | undefined> {
    return this.update(id, { scheduledAt });
  }
}

export const taskRepository = new TaskRepository();