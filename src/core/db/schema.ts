// ============================================================
// رِفق — Dexie Schema & Migrations
// كل store معرّف هنا بأسمائه وأزواجه وفهارسه.
// قاعدة: Repositories هي الطبقة الوحيدة التي تلمس Dexie.
// ============================================================

import Dexie, { type Table } from 'dexie';
import type {
  TaskRecord,
  CalendarEvent,
  LearningPath,
  PathItem,
  Session,
  ReflectionEntry,
  EnergyCheckin,
  ShariaText,
  Settings,
  BackupSnapshot,
  PrayerAnchor
} from '../types';

const DB_NAME = 'refq';
export const CURRENT_SCHEMA_VERSION = 4;

const V1_STORES = {
  tasks: 'id, status, scheduledAt, deadline, linkedPathItemId, order',
  calendarEvents: 'id, start, end, kind, linkedTaskId, pathId',
  paths: 'id, type, status, order, deadline',
  pathItems: 'id, pathId, parentId, status, order',
  sessions: 'id, pathItemId, date',
  notes: 'id, title, folderId, updatedAt',
  noteIndexes: 'noteId, updatedAt',
  folders: 'id, name, parentId',
  reflections: 'id, kind, date, linkedPathItemId',
  energyCheckins: 'id, date',
  shariaTexts: 'id, kind, pathId',
  settings: 'id',
  backups: 'id, createdAt, schemaVersion'
};

export interface RefqDatabase extends Dexie {
  tasks: Table<TaskRecord, string>;
  calendarEvents: Table<CalendarEvent, string>;
  paths: Table<LearningPath, string>;
  pathItems: Table<PathItem, string>;
  sessions: Table<Session, string>;
  reflections: Table<ReflectionEntry, string>;
  energyCheckins: Table<EnergyCheckin, string>;
  shariaTexts: Table<ShariaText, string>;
  settings: Table<Settings, string>;
  backups: Table<BackupSnapshot, string>;
  /** v2 — مراسي الصلوات (تأسيس معماري؛ لا UI في P1) */
  prayerAnchors: Table<PrayerAnchor, string>;
  /** v4 — كاش أحداث Google Calendar (قراءة فقط؛ مستثنى من النسخة الاحتياطية) */
  googleEventsCache: Table<CalendarEvent, string>;
}

class RefqDatabaseImpl extends Dexie {
  tasks!: Table<TaskRecord, string>;
  calendarEvents!: Table<CalendarEvent, string>;
  paths!: Table<LearningPath, string>;
  pathItems!: Table<PathItem, string>;
  sessions!: Table<Session, string>;
  reflections!: Table<ReflectionEntry, string>;
  energyCheckins!: Table<EnergyCheckin, string>;
  shariaTexts!: Table<ShariaText, string>;
  settings!: Table<Settings, string>;
  backups!: Table<BackupSnapshot, string>;
  prayerAnchors!: Table<PrayerAnchor, string>;
  googleEventsCache!: Table<CalendarEvent, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores(V1_STORES);
    // v2 — إضافة جدول مراسي الصلوات فقط؛ الجداول الأخرى تُورَّث تلقائيًا
    this.version(2).stores({
      prayerAnchors: 'id, date, prayer'
    });
    // v3 — إزالة جداول الملاحظات نهائيًا (قرار: لا قسم للملاحظات في رِفق)
    this.version(3).stores({
      notes: null,
      noteIndexes: null,
      folders: null
    });
    // v4 — كاش أحداث Google Calendar (مزامنة قراءة فقط، مستثنى من النسخ الاحتياطية)
    this.version(4).stores({
      googleEventsCache: 'id, start, source'
    });
  }
}

// المخطط القابل للتصدير (مفيد للاختبارات والتحقق)
export const dbSchema = {
  version: CURRENT_SCHEMA_VERSION,
  stores: [
    'tasks',
    'calendarEvents',
    'paths',
    'pathItems',
    'sessions',
    'reflections',
    'energyCheckins',
    'shariaTexts',
    'prayerAnchors',
    'settings',
    'backups',
    'googleEventsCache'
  ]
};

/**
 * محرك مصغّر للترقية متعدد الإصدارات.
 * v1 → v2: إضافة جدول prayerAnchors فقط — Dexie يديرها تلقائيًا بلا upgrade().
 */
interface Migration {
  version: number;
  upgrade(): void;
}
const migrations: Migration[] = [];

// Singleton — نفس قاعدة بيانات التطبيق عبر كل الجلسة
export const db = new RefqDatabaseImpl();

export { migrations };