// ============================================================
// رِفق — تكامل Google Calendar (قراءة فقط)
// OAuth عبر Google Identity Services (token flow) — الرمز في الذاكرة فقط:
// لا يُخزَّن في Dexie ولا localStorage ولا يدخل النسخ الاحتياطية.
// النطاق: calendar.readonly — رِفق لا تكتب ولا تعدّل ولا تحذف في جوجل أبدًا.
// لا Dexie هنا — الكتابة عبر googleCalendarRepository وحده.
// ============================================================

import type { CalendarEvent } from '../types';
import { addDaysKey, localDateTimeISO } from '../engines/calendarEngine';

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const EVENTS_ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
/** مدة افتراضية للمواعيد التي بلا نهاية صريحة عند جوجل */
const DEFAULT_DURATION_MS = 60 * 60 * 1000;
/** هامش أمان: يُعتبر الرمز منتهيًا قبل نهايته بدقيقة */
const TOKEN_EXPIRY_MARGIN_MS = 60 * 1000;
/** مدى المزامنة بالأيام القادمة */
const SYNC_WINDOW_DAYS = 90;

/** جلب بصلاحيات — قابل للحقن في الاختبارات */
export type GoogleFetcher = (
  url: string,
  init: { headers: Record<string, string> }
) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>;

/** حدث خام من Calendar API v3 (الحقول التي تهمّنا فقط) */
export interface GoogleApiEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  htmlLink?: string;
  updated?: string;
}

/** نتيجة مزامنة واحدة (قبل التخزين) */
export interface GoogleSyncResult {
  events: CalendarEvent[];
  /** النطاق الزمني الذي جُلب فعليًا */
  timeMin: string;
  timeMax: string;
  syncedAt: string;
}

// ————————————————— الإعدادات والتوصيل —————————————————

/** معرّف العميل من بيئة البناء — غيابه يعني أن المزامنة معطّلة بالكامل */
export function googleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
}

export function isGoogleCalendarConfigured(): boolean {
  return googleClientId().length > 0;
}

// ————————————————— مخزن الرمز (في الذاكرة فقط) —————————————————

interface TokenState {
  accessToken: string;
  /** epoch ms — نهاية صلاحية الرمز */
  expiresAt: number;
}

let tokenState: TokenState | null = null;

export function setGoogleAccessToken(accessToken: string, expiresInSec: number): void {
  const seconds = Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec : 3600;
  tokenState = { accessToken, expiresAt: Date.now() + seconds * 1000 };
}

/** الرمز الصالح حاليًا — يسقط تلقائيًا مع اقتراب انتهاء صلاحيته */
export function getGoogleAccessToken(): string | null {
  if (!tokenState) return null;
  if (Date.now() >= tokenState.expiresAt - TOKEN_EXPIRY_MARGIN_MS) {
    tokenState = null;
    return null;
  }
  return tokenState.accessToken;
}

export function isGoogleCalendarConnected(): boolean {
  return getGoogleAccessToken() !== null;
}

export function clearGoogleAccessToken(): void {
  tokenState = null;
}


// ————————————————— تحويل الأحداث (نقي) —————————————————

/**
 * تحويل حدث Google إلى CalendarEvent للعرض (قراءة فقط).
 * - يوم كامل (start.date): منتصف الليل المحلي حتى منتصف ليل اليوم التالي
 *   (نهاية جوجل حصرية فعلًا: حدث اليوم الواحد end.date = اليوم التالي)
 * - بوقت (start.dateTime): كما هو، وبلا نهاية صالحة = ساعة واحدة
 * - ملغى أو بغير معرّف أو بغير بداية صالحة → null (يتجاهله العرض)
 */
export function mapGoogleEvent(raw: GoogleApiEvent): CalendarEvent | null {
  if (!raw || !raw.id || raw.status === 'cancelled') return null;

  const start = raw.start ?? {};
  const end = raw.end ?? {};
  let startISO: string;
  let endISO: string;
  let allDay = false;

  if (start.date) {
    const startKey = start.date;
    const endKey = end.date && end.date > startKey ? end.date : addDaysKey(startKey, 1);
    startISO = localDateTimeISO(startKey, '00:00');
    endISO = localDateTimeISO(endKey, '00:00');
    allDay = true;
  } else if (start.dateTime) {
    const startMs = new Date(start.dateTime).getTime();
    if (!Number.isFinite(startMs)) return null;
    const rawEndMs = end.dateTime ? new Date(end.dateTime).getTime() : NaN;
    startISO = new Date(startMs).toISOString();
    endISO = new Date(
      Number.isFinite(rawEndMs) && rawEndMs > startMs ? rawEndMs : startMs + DEFAULT_DURATION_MS
    ).toISOString();
  } else {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: `gc-${raw.id}`,
    // جوجل تسمح بحدث بلا اسم — نص عرض محايد
    title: (raw.summary ?? '').trim() || 'حدث في تقويمي',
    // مواعيد جوجل ثابتة العرض دائمًا: لا تدخل إعادة التوزيع
    kind: 'fixed',
    start: startISO,
    end: endISO,
    source: 'google',
    allDay,
    note: raw.location?.trim() ? raw.location.trim() : undefined,
    createdAt: now,
    updatedAt: raw.updated ?? now
  };
}

// ————————————————— الجلب والمزامنة —————————————————

function localDayISO(date: Date, daysFromNow: number): string {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
  return localDateTimeISO(addDaysKey(key, daysFromNow), '00:00');
}

/** نافذة المزامنة: من منتصف ليل اليوم المحلي حتى بعد 90 يومًا */
export function defaultSyncWindow(now: Date = new Date()): { timeMin: string; timeMax: string } {
  return { timeMin: localDayISO(now, 0), timeMax: localDayISO(now, SYNC_WINDOW_DAYS) };
}

/**
 * جلب أحداث التقويم الأساسي في نطاق زمني كحدثات مفردة (singleEvents).
 * fetchImpl قابل للحقن — افتراضيًا fetch.
 */
export async function fetchGoogleEvents(input: {
  accessToken: string;
  timeMin: string;
  timeMax: string;
  fetchImpl?: GoogleFetcher;
}): Promise<GoogleApiEvent[]> {
  const fetchImpl = input.fetchImpl ?? (fetch as unknown as GoogleFetcher);
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: input.timeMin,
    timeMax: input.timeMax,
    maxResults: '2500'
  });
  const res = await fetchImpl(`${EVENTS_ENDPOINT}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${input.accessToken}` }
  });
  if (!res.ok) throw new Error(`google_calendar_fetch_failed (${res.status ?? '?'})`);
  const json = (await res.json()) as { items?: GoogleApiEvent[] };
  return Array.isArray(json?.items) ? json.items : [];
}

/** مزامنة كاملة: جلب + تحويل إلى أحداث عرض صالحة مرتبة بالوقت */
export async function syncGoogleCalendar(input: {
  accessToken: string;
  timeMin?: string;
  timeMax?: string;
  fetchImpl?: GoogleFetcher;
}): Promise<GoogleSyncResult> {
  const win = defaultSyncWindow();
  const timeMin = input.timeMin ?? win.timeMin;
  const timeMax = input.timeMax ?? win.timeMax;
  const raw = await fetchGoogleEvents({
    accessToken: input.accessToken,
    timeMin,
    timeMax,
    fetchImpl: input.fetchImpl
  });
  const events = raw
    .map(mapGoogleEvent)
    .filter((e): e is CalendarEvent => e !== null)
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));

  return { events, timeMin, timeMax, syncedAt: new Date().toISOString() };
}

/** مزامنة بالرمز المخزّن — ترمي خطأ لو لا رمز صالح */
export async function syncWithStoredToken(fetchImpl?: GoogleFetcher): Promise<GoogleSyncResult> {
  const token = getGoogleAccessToken();
  if (!token) throw new Error('google_calendar_not_connected');
  return syncGoogleCalendar({ accessToken: token, fetchImpl });
}

// ————————————————— تدفق OAuth (متصفح فقط) —————————————————

interface GisTokenResponse {
  access_token?: string;
  /** جوجل ترسله نصيًا */
  expires_in?: string | number;
  error?: string;
}

interface GoogleGis {
  accounts?: {
    oauth2?: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: GisTokenResponse) => void;
        error_callback?: (error: { type?: string }) => void;
      }): { requestAccessToken(): void };
      revoke?(token: string, done?: () => void): void;
    };
  };
}

type GisOAuth2 = NonNullable<NonNullable<GoogleGis['accounts']>['oauth2']>;

function gisOAuth2(): GisOAuth2 | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { google?: GoogleGis }).google?.accounts?.oauth2;
}

let gisLoading: Promise<void> | null = null;

/** تحميل سكربت GIS مرة واحدة — نفس الـ promise يُعاد عند التكرار */
export function loadGisScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.reject(new Error('gis_no_browser'));
  if (gisOAuth2()) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoading = null;
      reject(new Error('gis_load_failed'));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

/**
 * بدء تدفق الموافقة — يفتح نافذة جوجل ثم يخزّن الرمز في الذاكرة ويعيده.
 * تُنادى من زر صريح في الإعدادات فقط (لا تلقائيًا أبدًا).
 */
export async function requestGoogleAccessToken(): Promise<string> {
  const clientId = googleClientId();
  if (!clientId) throw new Error('google_calendar_not_configured');
  await loadGisScript();
  const oauth2 = gisOAuth2();
  if (!oauth2) throw new Error('gis_unavailable');

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPE,
      callback: (response) => {
        if (response?.access_token) {
          const expiresIn = Number.parseInt(String(response.expires_in ?? '3600'), 10);
          setGoogleAccessToken(response.access_token, Number.isFinite(expiresIn) ? expiresIn : 3600);
          resolve(response.access_token);
          return;
        }
        reject(new Error(response?.error ?? 'google_auth_denied'));
      },
      error_callback: (error) => reject(new Error(error?.type ?? 'google_popup_closed'))
    });
    client.requestAccessToken();
  });
}

/** قطع الاتصال: محو الرمز من الذاكرة + إبطاله عند جوجل إن أمكن */
export async function disconnectGoogleCalendar(): Promise<void> {
  const token = tokenState?.accessToken;
  clearGoogleAccessToken();
  const revoke = gisOAuth2()?.revoke;
  if (token && revoke) {
    await new Promise<void>((resolve) => revoke(token, () => resolve()));
  }
}

