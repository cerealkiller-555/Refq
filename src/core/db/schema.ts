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
  Note,
  NoteIndex,
  Folder,
  ReflectionEntry,
  EnergyCheckin,
  ShariaText,
  Settings,
  BackupSnapshot
} from '../types';

const DB_NAME = 'refq';
export const CURRENT_SCHEMA_VERSION = 1;

export interface RefqDatabase extends Dexie {
  tasks: Table<TaskRecord, string>;
  calendarEvents: Table<CalendarEvent, string>;
  paths: Table<LearningPath, string>;
  pathItems: Table<PathItem, string>;
  sessions: Table<Session, string>;
  notes: Table<Note, string>;
  noteIndexes: Table<NoteIndex, string>;
  folders: Table<Folder, string>;
  reflections: Table<ReflectionEntry, string>;
  energyCheckins: Table<EnergyCheckin, string>;
  shariaTexts: Table<ShariaText, string>;
  settings: Table<Settings, string>;
  backups: Table<BackupSnapshot, string>;
}

class RefqDatabaseImpl extends Dexie {
  tasks!: Table<TaskRecord, string>;
  calendarEvents!: Table<CalendarEvent, string>;
  paths!: Table<LearningPath, string>;
  pathItems!: Table<PathItem, string>;
  sessions!: Table<Session, string>;
  notes!: Table<Note, string>;
  noteIndexes!: Table<NoteIndex, string>;
  folders!: Table<Folder, string>;
  reflections!: Table<ReflectionEntry, string>;
  energyCheckins!: Table<EnergyCheckin, string>;
  shariaTexts!: Table<ShariaText, string>;
  settings!: Table<Settings, string>;
  backups!: Table<BackupSnapshot, string>;

  constructor() {
    super(DB_NAME);
    this.version(CURRENT_SCHEMA_VERSION).stores({
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
    'notes',
    'noteIndexes',
    'folders',
    'reflections',
    'energyCheckins',
    'shariaTexts',
    'settings',
    'backups'
  ]
};

/**
 * محرك مصغّر للترقية متعدد الإصدارات.
 * كل إضافة migration تضيف خطوة في مصفوفة migrations.
 * نبدأ v1، لذا هذا skeleton جاهز للنسخ القادمة (sync, fields...)
 */
interface Migration {
  version: number;
  upgrade(): void;
}
// مستقبلًا:
// const migrations: Migration[] = [
//   { version: 2, upgrade: () => { /* مثلا إضافة فهرس جديد */ } },
// ];
const migrations: Migration[] = [];

// Singleton — نفس قاعدة بيانات التطبيق عبر كل الجلسة
export const db = new RefqDatabaseImpl();

export { migrations };