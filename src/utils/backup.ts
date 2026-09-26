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

  // كاش جوجل خارج النسخة الاحتياطية (بيانات جوجل تُعاد مزامنتها) — يُمسح حتى لا يبقى stale
  await db.googleEventsCache.clear();

  if (d.tasks) { await db.tasks.clear(); await db.tasks.bulkPut(d.tasks); results.push('tasks'); }
  if (d.calendarEvents) { await db.calendarEvents.clear(); await db.calendarEvents.bulkPut(d.calendarEvents); results.push('calendarEvents'); }
  if (d.paths) { await db.paths.clear(); await db.paths.bulkPut(d.paths); results.push('paths'); }
  if (d.pathItems) { await db.pathItems.clear(); await db.pathItems.bulkPut(d.pathItems); results.push('pathItems'); }
  if (d.sessions) { await db.sessions.clear(); await db.sessions.bulkPut(d.sessions); results.push('sessions'); }
  if (d.reflections) { await db.reflections.clear(); await db.reflections.bulkPut(d.reflections); results.push('reflections'); }
  if (d.energyCheckins) { await db.energyCheckins.clear(); await db.energyCheckins.bulkPut(d.energyCheckins); results.push('energyCheckins'); }
  if (d.shariaTexts) { await db.shariaTexts.clear(); await db.shariaTexts.bulkPut(d.shariaTexts); results.push('shariaTexts'); }
  if (d.prayerAnchors) { await db.prayerAnchors.clear(); await db.prayerAnchors.bulkPut(d.prayerAnchors); results.push('prayerAnchors'); }
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