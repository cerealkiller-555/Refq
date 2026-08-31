// ============================================================
// رِفق — Backup & Import/Export (ملكية البيانات)
// exportJSON يكوّن حزمة versioned. importJSON يستعيدها.
// إثبات: بياناتك ملكك وقابلة للخروج بسهولة.
// ============================================================

import { db, CURRENT_SCHEMA_VERSION } from '../core/db/schema';
import type { BackupSnapshot } from '../core/types';

/** إنشاء نسخة احتياطية كاملة (كل الجداول) بصيغة JSON versioned */
export async function exportAll(): Promise<BackupSnapshot> {
  const [tasks, calendarEvents, paths, pathItems, sessions, notes, noteIndexes, folders, reflections, energyCheckins, shariaTexts, settings] =
    await Promise.all([
      db.tasks.toArray(),
      db.calendarEvents.toArray(),
      db.paths.toArray(),
      db.pathItems.toArray(),
      db.sessions.toArray(),
      db.notes.toArray(),
      db.noteIndexes.toArray(),
      db.folders.toArray(),
      db.reflections.toArray(),
      db.energyCheckins.toArray(),
      db.shariaTexts.toArray(),
      db.settings.toArray()
    ]);

  return {
    id: `backup-${Date.now()}`,
    createdAt: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    data: {
      tasks,
      calendarEvents,
      paths,
      pathItems,
      sessions,
      notes,
      noteIndexes,
      folders,
      reflections,
      energyCheckins,
      shariaTexts,
      settings
    }
  };
}

/** هل النسخة مدعومة؟ (لا نستورد نسخًا مستقبلية غير معروفة) */
export function isVersionSupported(schemaVersion: number): boolean {
  return typeof schemaVersion === 'number' && schemaVersion >= 1 && schemaVersion <= CURRENT_SCHEMA_VERSION;
}

/**
 * استيراد كامل: يمحو كل شيء حاليًا (بعد تأكيد المستخدم) ثم يكتب البيانات المستوردة.
 * يعيد أسماء الجداول التي استُوردت، أو يرمي خطأ لو نسخة غير مدعومة.
 */
export async function importAll(snapshot: BackupSnapshot): Promise<string[]> {
  if (!isVersionSupported(snapshot.schemaVersion)) {
    throw new Error(`نسخة النسخة الاحتياطية (${snapshot.schemaVersion}) غير مدعومة.`);
  }

  // يأقل في كل جدول الحالي ثم يضع البديل الجديد بضربة واحدة
  const d = snapshot.data;
  const results: string[] = [];

  if (d.tasks) { await db.tasks.clear(); await db.tasks.bulkPut(d.tasks); results.push('tasks'); }
  if (d.calendarEvents) { await db.calendarEvents.clear(); await db.calendarEvents.bulkPut(d.calendarEvents); results.push('calendarEvents'); }
  if (d.paths) { await db.paths.clear(); await db.paths.bulkPut(d.paths); results.push('paths'); }
  if (d.pathItems) { await db.pathItems.clear(); await db.pathItems.bulkPut(d.pathItems); results.push('pathItems'); }
  if (d.sessions) { await db.sessions.clear(); await db.sessions.bulkPut(d.sessions); results.push('sessions'); }
  if (d.notes) { await db.notes.clear(); await db.notes.bulkPut(d.notes); results.push('notes'); }
  if (d.noteIndexes) { await db.noteIndexes.clear(); await db.noteIndexes.bulkPut(d.noteIndexes); results.push('noteIndexes'); }
  if (d.folders) { await db.folders.clear(); await db.folders.bulkPut(d.folders); results.push('folders'); }
  if (d.reflections) { await db.reflections.clear(); await db.reflections.bulkPut(d.reflections); results.push('reflections'); }
  if (d.energyCheckins) { await db.energyCheckins.clear(); await db.energyCheckins.bulkPut(d.energyCheckins); results.push('energyCheckins'); }
  if (d.shariaTexts) { await db.shariaTexts.clear(); await db.shariaTexts.bulkPut(d.shariaTexts); results.push('shariaTexts'); }
  if (d.settings) { await db.settings.clear(); await db.settings.bulkPut(d.settings); results.push('settings'); }

  return results;
}

/** حذف كل البيانات نهائيًا (مع تأكيد المستخدم في الـ UI) */
export async function deleteAllData(): Promise<void> {
  await Promise.all([
    db.tasks.clear(),
    db.calendarEvents.clear(),
    db.paths.clear(),
    db.pathItems.clear(),
    db.sessions.clear(),
    db.notes.clear(),
    db.noteIndexes.clear(),
    db.folders.clear(),
    db.reflections.clear(),
    db.energyCheckins.clear(),
    db.shariaTexts.clear(),
    db.settings.clear(),
    db.backups.clear()
  ]);
}

/** تنزيل JSON للمتصفح */
export function downloadJSON(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}