// ============================================================
// رِفق — Backup & Import/Export (ملكية البيانات)
// exportJSON يكوّن حزمة versioned. importJSON يستعيدها.
// إثبات: بياناتك ملكك وقابلة للخروج بسهولة.
// ============================================================

import { db, CURRENT_SCHEMA_VERSION } from '../core/db/schema';
import type { BackupSnapshot } from '../core/types';

/** إنشاء نسخة احتياطية كاملة (كل الجداول) بصيغة JSON versioned */
export async function exportAll(): Promise<BackupSnapshot> {
  const [tasks, calendarEvents, paths, pathItems, sessions, reflections, energyCheckins, shariaTexts, prayerAnchors, settings] =
    await Promise.all([
      db.tasks.toArray(),
      db.calendarEvents.toArray(),
      db.paths.toArray(),
      db.pathItems.toArray(),
      db.sessions.toArray(),
      db.reflections.toArray(),
      db.energyCheckins.toArray(),
      db.shariaTexts.toArray(),
      db.prayerAnchors.toArray(),
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
      reflections,
      energyCheckins,
      shariaTexts,
      prayerAnchors,
      settings
    }
  };
}

/** هل النسخة مدعومة؟ (لا نستورد نسخًا مستقبلية غير معروفة) */
export function isVersionSupported(schemaVersion: number): boolean {
  return typeof schemaVersion === 'number' && schemaVersion >= 1 && schemaVersion <= CURRENT_SCHEMA_VERSION;
}

/**
 * استيراد كامل: يمحو كل البيانات الحالية (بعد تأكيد المستخدم) ثم يكتب البيانات المستوردة.
 * استبدال شامل لا دمج: كل جداول النسخة تُفرَّغ دائمًا — وغياب جدول في الملف = صفر فيه،
 * حتى يطابق السلوك نص التأكيد ولا تختلط بيانات قديمة بناقصة. كاش Google يُمسح دائمًا.
 * يعيد أسماء الجداول التي عُبّئت من الملف، أو يرمي خطأ لو نسخة غير مدعومة.
 */
export async function importAll(snapshot: BackupSnapshot): Promise<string[]> {
  if (!isVersionSupported(snapshot.schemaVersion)) {
    throw new Error(`نسخة النسخة الاحتياطية (${snapshot.schemaVersion}) غير مدعومة.`);
  }

  // إفراغ شامل أولًا (استبدال لا دمج) — شاملًا جداول النسخة وكاش جوجل
  const d = snapshot.data;
  const results: string[] = [];
  await Promise.all([
    db.tasks.clear(),
    db.calendarEvents.clear(),
    db.paths.clear(),
    db.pathItems.clear(),
    db.sessions.clear(),
    db.reflections.clear(),
    db.energyCheckins.clear(),
    db.shariaTexts.clear(),
    db.prayerAnchors.clear(),
    db.settings.clear(),
    db.googleEventsCache.clear()
  ]);

  if (d.tasks) { await db.tasks.bulkPut(d.tasks); results.push('tasks'); }
  if (d.calendarEvents) { await db.calendarEvents.bulkPut(d.calendarEvents); results.push('calendarEvents'); }
  if (d.paths) { await db.paths.bulkPut(d.paths); results.push('paths'); }
  if (d.pathItems) { await db.pathItems.bulkPut(d.pathItems); results.push('pathItems'); }
  if (d.sessions) { await db.sessions.bulkPut(d.sessions); results.push('sessions'); }
  if (d.reflections) { await db.reflections.bulkPut(d.reflections); results.push('reflections'); }
  if (d.energyCheckins) { await db.energyCheckins.bulkPut(d.energyCheckins); results.push('energyCheckins'); }
  if (d.shariaTexts) { await db.shariaTexts.bulkPut(d.shariaTexts); results.push('shariaTexts'); }
  if (d.prayerAnchors) { await db.prayerAnchors.bulkPut(d.prayerAnchors); results.push('prayerAnchors'); }
  if (d.settings) { await db.settings.bulkPut(d.settings); results.push('settings'); }

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
    db.reflections.clear(),
    db.energyCheckins.clear(),
    db.shariaTexts.clear(),
    db.prayerAnchors.clear(),
    db.settings.clear(),
    db.backups.clear(),
    db.googleEventsCache.clear()
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