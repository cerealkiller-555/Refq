// ============================================================
// رِفق — اختبارات طبقة البيانات (P0.3)
// يتحقق أن schema مفتوح، وCRUD يعمل، والـ Repos بشغلها
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  taskRepository,
  energyCheckinRepository,
  reflectionRepository,
  pathItemRepository,
  learningPathRepository,
  noteRepository,
  folderRepository
} from '../src/core/db/repositories';
import { db } from '../src/core/db/schema';

describe('Refq Database', () => {
  beforeEach(async () => {
    // تنظيف كل الجداول قبل كل اختبار
    await db.delete();
    await db.open();
  });

  it('يفتح المخطط ويحتوي كل الجداول الأساسية', async () => {
    const tables = db.tables.map((t) => t.name);
    for (const expected of [
      'tasks',
      'calendarEvents',
      'paths',
      'pathItems',
      'sessions',
      'notes',
      'noteIndexes',
      'folders',
      'reflections',
      'energyCheckins',
      'shariaTexts',
      'settings',
      'backups'
    ]) {
      expect(tables).toContain(expected);
    }
  });

  it('Task Repository — إنشاء وتعديل وعلامة إنجاز', async () => {
    const task = await taskRepository.create({
      title: 'مراجعة محاضرة 4',
      importance: 'high',
      urgency: 'high',
      estimatedDuration: 45,
      status: 'todo'
    } as Parameters<typeof taskRepository.create>[0]);
    expect(task.id).toBeTruthy();
    expect(task.status).toBe('todo');

    const updated = await taskRepository.markDone(task.id);
    expect(updated?.status).toBe('done');

    const open = await taskRepository.getOpenTasks();
    expect(open.find((t) => t.id === task.id)).toBeUndefined();
  });

  it('Learning Repo — إنشاء مسار وعناصر وأول عنصر قادم', async () => {
    const path = await learningPathRepository.create({
      title: 'مادة المحاسبة',
      type: 'university',
      status: 'active',
      order: 1
    } as Parameters<typeof learningPathRepository.create>[0]);

    const item1 = await pathItemRepository.create({
      pathId: path.id,
      title: 'محاضرة 1',
      order: 1,
      status: 'done'
    } as Parameters<typeof pathItemRepository.create>[0]);

    const item2 = await pathItemRepository.create({
      pathId: path.id,
      title: 'محاضرة 2',
      order: 2,
      status: 'todo'
    } as Parameters<typeof pathItemRepository.create>[0]);

    const items = await pathItemRepository.getByPath(path.id);
    expect(items).toHaveLength(2);
    expect(items.sort((a, b) => a.order - b.order)[0].id).toBe(item1.id);

    const next = await pathItemRepository.getNextItem(path.id);
    expect(next?.id).toBe(item2.id);
  });

  it('Heart Repo — تسجيل طاقة اليوم بشكل upsert منطقي (نفس المعرف)', async () => {
    const first = await energyCheckinRepository.upsertToday('low', 'كنت متعبة', false);
    const second = await energyCheckinRepository.upsertToday('high', 'تحسنت', true);

    const today = await energyCheckinRepository.getToday();
    expect(today?.level).toBe('high');
    expect(today?.note).toBe('تحسنت');
    // نفس اليوم → نفس المعرف (upsert مجمع وليس إدخالًا مكررًا)
    expect(today?.id).toBe(second.id);
    expect(first.id).toBe(second.id);
  });

  it('Vault Repo — إنشاء Note وربط Folder', async () => {
    const folder = await folderRepository.create({
      name: 'التفسير'
    } as Parameters<typeof folderRepository.create>[0]);

    const note = await noteRepository.createNote('فوائد سورة الكهف', '# فوائد\n\nنص', folder.id);
    const fetched = await noteRepository.get(note.id);
    expect(fetched?.rawMarkdown).toBe('# فوائد\n\nنص');

    const byFolder = await noteRepository.getByFolder(folder.id);
    expect(byFolder.map((n) => n.id)).toContain(note.id);

    // تحديث markdown
    await noteRepository.updateMarkdown(note.id, '# فوائد محدثة');
    const after = await noteRepository.get(note.id);
    expect(after?.rawMarkdown).toBe('# فوائد محدثة');
  });

  it('Reflection Repo — إضافة تأمل بعد عنصر تعلّم', async () => {
    const reflection = await reflectionRepository.addEntry(
      'athar',
      { learned: 'فضل الصبر', action: 'أتدرب عليه هذا الأسبوع' },
      { linkedPathItemId: 'item1' }
    );
    expect(reflection.kind).toBe('athar');
    expect(reflection.answers.action).toBe('أتدرب عليه هذا الأسبوع');

    const byKind = await reflectionRepository.getByKind('athar');
    expect(byKind.map((r) => r.id)).toContain(reflection.id);
  });
});