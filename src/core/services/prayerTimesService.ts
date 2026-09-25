// ============================================================
// رِفق — خدمة مواقيت الصلاة (Aladhan — مجانية بلا مفتاح، CORS متاح)
// تحويل مواقيت اليوم إلى مراسي PrayerAnchor (source: 'service')
// لا Dexie هنا — Service فقط، والتخزين عبر الـRepository هو الوحيد.
// الفشل = خطأ يُعالج بصمت في المتصل (fallback) — لا شاشة خطأ أبدًا.
// ============================================================

import type { PrayerAnchor, PrayerKey } from '../types';
import { localDateKey } from '../../utils';
import { localDateTimeISO } from '../engines/calendarEngine';

export type PrayerTimesData = Array<Omit<PrayerAnchor, 'id' | 'createdAt' | 'updatedAt'>>;

export interface PrayerTimesInput {
  dateKey?: string; // YYYY-MM-DD — افتراضيًا اليوم
  lat: number;
  lon: number;
  method?: number;
}

export type Fetcher = (url: string) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>;

const API_BASE = 'https://api.aladhan.com/v1/timings';
/** method=5 → الهيئة المصرية العامة للمساحة (افتراضي مناسب) */
const DEFAULT_METHOD = 5;

const PRAYER_KEYS: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

function toDDMMYYYY(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d}-${m}-${y}`;
}

interface AladhanTimings {
  Fajr?: string;
  Dhuhr?: string;
  Asr?: string;
  Maghrib?: string;
  Isha?: string;
}

const API_KEYS: Record<PrayerKey, keyof AladhanTimings> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha'
};

/** قراءة موعد HH:mm (24h) لصلاة من استجابة الخدمة — غياب الموعد = خطأ */
function readTiming(timings: AladhanTimings, prayer: PrayerKey): string {
  const value = timings[API_KEYS[prayer]];
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) {
    throw new Error(`موعد ${API_KEYS[prayer]} غير موجود في استجابة الخدمة`);
  }
  return value;
}

/**
 * جلب مواقيت اليوم وتحويلها إلى مراسٍ (source: 'service').
 * fetchImpl قابل للحقن للاختبار — افتراضيًا fetch.
 */
export async function fetchPrayerAnchors(
  input: PrayerTimesInput,
  fetchImpl: Fetcher = fetch as unknown as Fetcher
): Promise<PrayerTimesData> {
  const dateKey = input.dateKey ?? localDateKey();
  const method = input.method ?? DEFAULT_METHOD;
  const url = `${API_BASE}/${toDDMMYYYY(dateKey)}?latitude=${input.lat}&longitude=${input.lon}&method=${method}&timeFormat=24h`;

  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`فشل جلب المواقيت (${res.status})`);
  const json = (await res.json()) as { code?: number; data?: { timings?: AladhanTimings } };
  if (!json || json.code !== 200 || !json.data?.timings) {
    throw new Error('استجابة مواقيت غير صالحة');
  }

  return PRAYER_KEYS.map((prayer) => ({
    date: dateKey,
    prayer,
    time: localDateTimeISO(dateKey, readTiming(json.data!.timings!, prayer)),
    source: 'service' as const
  }));
}