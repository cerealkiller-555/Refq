// ============================================================
// رِفق — اختبارات Backup/Import (P0.6)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/core/db/schema';
import { exportAll, importAll, isVersionSupported, deleteAllData } from '../src/utils/backup';
import { taskRepository } from '../src/core/db/repositories';

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
    expect(snapshot.data.notes).toBeDefined();
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
});