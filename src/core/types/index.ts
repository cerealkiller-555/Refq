// ============================================================
// رِفق — الأنواع المركزي (Core Types)
// كل الأنواع union-based قابلة للتوسعة بدون تغيير البنية
// ============================================================

// ===== الأدوات المشتركة =====

export type ID = string;

export interface Timestamps {
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// ===== Planning =====

export type TaskImportance = 'high' | 'low';
export type TaskUrgency = 'high' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface BaseTask extends Timestamps {
  id: ID;
  title: string;
  description?: string;
  importance: TaskImportance;
  urgency: TaskUrgency;
  estimatedDuration: number; // minutes
  deadline?: string; // ISO date
  status: TaskStatus;
  linkedPathItemId?: string;
  energyRequired?: 'low' | 'medium' | 'high';
  scheduledAt?: string; // ISO datetime — for calendar binding
  order?: number;
}

// قاعدة بيانات المهام (تُخزن في Dexie)
export interface TaskRecord extends BaseTask {}

export type CalendarEventKind = 'fixed' | 'flexible';

export interface CalendarEvent extends Timestamps {
  id: ID;
  title: string;
  kind: CalendarEventKind;
  start: string; // ISO
  end: string; // ISO
  recurring?: { freq: 'daily' | 'weekly'; until?: string };
  linkedTaskId?: ID;
  linkedSessionId?: ID;
  pathId?: ID;
  itemId?: ID;
  note?: string;
}

// ===== Learning =====

export type LearningPathType =
  | 'university'
  | 'course'
  | 'sharia_course'
  | 'book'
  | 'quran'
  | 'sharia_knowledge';

export type LearningPathStatus = 'active' | 'paused' | 'done';

export interface LearningPath extends Timestamps {
  id: ID;
  title: string;
  description?: string;
  type: LearningPathType;
  status: LearningPathStatus;
  deadline?: string;
  importance?: 'high' | 'medium' | 'low';
  order: number;
  // بيانات نوعية (قابلة للتوسيع بالنوع)
  meta?: Record<string, unknown>;
}

export type PathItemStatus = 'todo' | 'in_progress' | 'done';

export interface PathItem extends Timestamps {
  id: ID;
  pathId: ID;
  parentId?: ID; // tree structure
  title: string;
  order: number;
  estimatedDuration?: number; // minutes
  deadline?: string;
  status: PathItemStatus;
  linkedNoteId?: ID;
  energyRequired?: 'low' | 'medium' | 'high';
}

export interface Session extends Timestamps {
  id: ID;
  pathItemId: ID;
  date: string; // ISO
  durationMinutes: number;
  note?: string;
}

// ===== Vault =====

// Markdown هو المصدر الوحيد للحقيقة (rawMarkdown)
export interface Note extends Timestamps {
  id: ID;
  title: string;
  rawMarkdown: string;
  folderId?: ID;
}

// مشتقات — قابلة لإعادة البناء الكاملة من rawMarkdown
export interface NoteIndex {
  noteId: ID;
  tags: string[];
  properties: Record<string, string>;
  outboundLinks: string[]; // أسماء/عناوين الملاحظات من [[...]]
  updatedAt: string;
}

export interface Folder extends Timestamps {
  id: ID;
  name: string;
  parentId?: ID;
}

// ===== Heart =====

export type ReflectionKind =
  | 'athar' // أثر
  | 'search_heart' // فتش عن قلبك
  | 'waqfa' // وقفة
  | 'muhasaba'; // محاسبة

export interface ReflectionEntry extends Timestamps {
  id: ID;
  kind: ReflectionKind;
  date: string; // ISO date
  linkedPathItemId?: ID;
  answers: Record<string, string>;
  skipped: boolean;
}

// ===== Prayer Anchors (مراسي الصلوات) =====
// الصلوات هي العلامات الطبيعية لتقسيم اليوم — ليس مجرد يوم من 00:00 إلى 24:00.
// لا يُستنتج الموعد أبدًا: يدوي الآن، ومن خدمة مواقيت لاحقًا (P2) بنفس النموذج.

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface PrayerAnchor extends Timestamps {
  id: ID;
  date: string; // YYYY-MM-DD (تاريخ محلي)
  prayer: PrayerKey;
  time: string; // ISO datetime
  source: 'manual' | 'service';
}

// فترة زمنية بين مرساة وأخرى — مساحة تخطيط مستقلة نسبيًا
export interface DayPeriod {
  anchor: PrayerKey | 'night'; // بداية الفترة ('night' = ليل قبل الفجر أو بعد العشاء)
  start: string | null; // ISO — بداية الفترة
  end: string | null; // ISO — نهاية الفترة (وقت الصلاة التالية)، null = مفتوحة
  remainingMinutes: number | null; // المتبقي الآن؛ null = بلا سقف عملي
}

// ===== System =====

export type EnergyLevel = 'low' | 'medium' | 'high';

export interface EnergyCheckin extends Timestamps {
  id: ID;
  date: string; // ISO date (فريد يوميًا منطقيًا)
  level: EnergyLevel;
  note?: string;
  wantsLightDay: boolean;
}

export type ShariaTextKind =
  | 'ayah' // آية
  | 'hadith' // حديث
  | 'scholar_quote' // قول عالم
  | 'faida' // فائدة
  | 'tarif'; // تعريف

export interface ShariaText extends Timestamps {
  id: ID;
  kind: ShariaTextKind;
  text: string;
  source: string; // النص + المصدر إلزاميان — لا نصوص بلا مصدر
  linkedNoteId?: ID;
  pathId?: ID;
}

export interface Settings extends Timestamps {
  id: string; // 'main'
  direction: string[]; // لماذا أتعلم؟ (طلب العلم، فهم ديني...)
  weekStopperDay?: number; // يوم "وقفة" الأسبوعي (0-6)
  studyCapMinutes?: number; // سقف الدراسة اليومي
  notifyPrefs: {
    remindersEnabled: boolean;
    atarFollowUp: boolean;
    heartCheck: boolean;
    waqfa: boolean;
  };
  tone?: string;
  name?: string;
  onboardingDone: boolean;
}

// ===== Backup =====

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  schemaVersion: number;
  data: {
    tasks?: TaskRecord[];
    calendarEvents?: CalendarEvent[];
    paths?: LearningPath[];
    pathItems?: PathItem[];
    sessions?: Session[];
    notes?: Note[];
    noteIndexes?: NoteIndex[];
    folders?: Folder[];
    reflections?: ReflectionEntry[];
    energyCheckins?: EnergyCheckin[];
    shariaTexts?: ShariaText[];
    prayerAnchors?: PrayerAnchor[];
    settings?: Settings[];
  };
}