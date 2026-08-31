// ============================================================
// رِفق — Base Repository (عام)
// يوفر CRUD موحد لكل جدول وتفادي التكرار.
// لا تستخدم Repositories مباشرة لتعديل الـUI، بل عبر الـstores.
// ============================================================

import type { Table } from 'dexie';
import { generateId, nowISO } from '../../../utils';

/** عقد حول جدول Dexie يعطي عمليات آمنة وموحّدة */
export class BaseRepository<T extends { id: string }> {
  constructor(protected readonly table: Table<T, string>) {}

  /** إنشاء سجل جديد مع توليد id وتواريخ إن أمكن */
  async create(data: Omit<T, 'id'>): Promise<T> {
    const id = generateId();
    const record = {
      ...(data as object),
      id,
      createdAt: nowISO(),
      updatedAt: nowISO()
    } as unknown as T;
    await this.table.add(record);
    return record;
  }

  /** إنشاء دفعة (للـ import والـ seed) — يتجاوز التواريخ */
  async bulkPut(records: T[]): Promise<void> {
    await this.table.bulkPut(records);
  }

  async get(id: string): Promise<T | undefined> {
    return this.table.get(id);
  }

  async getAll(): Promise<T[]> {
    return this.table.toArray();
  }

  /** تعديل جزئي (يتحدّث updatedAt إن وُجد) */
  async update(id: string, changes: Partial<T>): Promise<T | undefined> {
    const existing = await this.table.get(id);
    if (!existing) return undefined;
    const merged = {
      ...existing,
      ...changes,
      updatedAt: nowISO()
    } as T;
    await this.table.put(merged);
    return merged;
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  async clear(): Promise<void> {
    await this.table.clear();
  }

  /** بحث بالحقل والفهرس — لا يستخدم إلا مع فهارس معرّفة */
  protected where<K extends keyof T & string>(field: K, value: unknown) {
    return this.table.where(field).equals(value as never);
  }
}