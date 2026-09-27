// ============================================================
// رِفق — اختبارات Backup/Import (P0.6)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/core/db/schema';
import { exportAll, importAll, isVersionSupported, deleteAllData } from '../src/utils/backup';
import { taskRepository, learningPathRepository } from '../src/core/db/repositories';

describe('Backup System', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('exportAll يغطي كل الجداول', async () => {
    await taskRepository.create({
      title: 'مهمة للنسخ',
      importance: 'high',
      urgency: 'low',
      estimatedDuration: 30,
      status: 'todo'
    } as Parameters<typeof taskRepository.create>[0]);

    const snapshot = await exportAll();
    expect(snapshot.schemaVersion).toBeGreaterThanOrEqual(1);
    expect(snapshot.data.tasks).toHaveLength(1);
  });

  it('importAll يستعيد البيانات في قاعدة فارغة تمامًا', async () => {
    // أنشئ بيانات
    await taskRepository.create({
      title: 'مهمة للاستيراد',
      importance: 'high',
      urgency: 'low',
      estimatedDuration: 30,
      status: 'todo'
    } as Parameters<typeof taskRepository.create>[0]);
    const snapshot = await exportAll();

    // امسح كل شيء
    await deleteAllData();
    expect(await db.tasks.count()).toBe(0);

    // استورد
    const imported = await importAll(snapshot);
    expect(imported).toContain('tasks');
    expect(await db.tasks.count()).toBe(1);
    const first = await db.tasks.filter((t) => t.title === 'مهمة للاستيراد').first();
    expect(first?.title).toBe('مهمة للاستيراد');
  });

  it('يرفض نسخة مستقبلية غير مدعومة', async () => {
    const unsupported = { ...(await exportAll()), schemaVersion: 999 };
    await expect(importAll(unsupported)).rejects.toThrow('غير مدعومة');
  });

  it('isVersionSupported يعمل للنطاق الحالي فقط', () => {
    expect(isVersionSupported(1)).toBe(true);
    expect(isVersionSupported(0)).toBe(false);
    expect(isVersionSupported(999)).toBe(false);
  });

  it('استيراد نسخة جزئية = استبدال شامل (الجداول المفقودة تُفرَّغ — لا دمج صامت)', async () => {
    const incoming = await taskRepository.create({
      title: 'من الملف',
      importance: 'low',
      urgency: 'low',
      estimatedDuration: 30,
      status: 'todo'
    } as Parameters<typeof taskRepository.create>[0]);
    const full = await exportAll();

    // بيانات أُضيفت بعد تصدير النسخة — يجب أن تزول (استبدال لا دمج)
    await taskRepository.create({
      title: 'بعد التصدير',
      importance: 'low',
      urgency: 'low',
      estimatedDuration: 30,
      status: 'todo'
    } as Parameters<typeof taskRepository.create>[0]);
    await learningPathRepository.create({
      title: 'مسار قديم',
      type: 'course',
      status: 'active',
      order: 1
    } as Parameters<typeof learningPathRepository.create>[0]);
    expect(await db.paths.count()).toBe(1);

    const partial = { ...full, data: { tasks: full.data.tasks } };
    const imported = await importAll(partial);

    expect(imported).toEqual(['tasks']);
    const titles = (await db.tasks.toArray()).map((t) => t.title);
    expect(titles).toEqual([incoming.title]);
    expect(await db.paths.count()).toBe(0); // جدول مفقود في الملف ⇒ صفر
  });

  it('الاستيراد يفرّغ كاش Google دائمًا (يُعاد مزامنته من Google)', async () => {
    await db.googleEventsCache.put({
      id: 'g1',
      title: 'حدث جوجل',
      kind: 'fixed',
      start: '2026-01-12T10:00:00.000Z',
      end: '2026-01-12T11:00:00.000Z',
      source: 'google',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });

    await importAll(await exportAll());

    expect(await db.googleEventsCache.count()).toBe(0);
  });
});