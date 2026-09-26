// ============================================================
// رِفق — اختبارات تكامل Google Calendar (قراءة فقط)
// 1) تحويل الأحداث: بوقت / طوال اليوم / ملغى / ناقص
// 2) الجلب: هيدر التفويض + النطاق الزمني + التعامل مع الفشل
// 3) مخزن الرمز: في الذاكرة ويسقط مع الانتهاء
// 4) الكاش المحلي: استبدال ذرّي + نطاق زمني + خارج النسخ الاحتياطية
// 5) المتجر: syncGoogle يكتب الكاش ويحدّث العرض، وفك الربط يُنظّف
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mapGoogleEvent,
  defaultSyncWindow,
  fetchGoogleEvents,
  syncGoogleCalendar,
  syncWithStoredToken,
  setGoogleAccessToken,
  getGoogleAccessToken,
  isGoogleCalendarConnected,
  clearGoogleAccessToken,
  GOOGLE_CALENDAR_SCOPE,
  type GoogleFetcher
} from '../src/core/integrations/googleCalendar';
import { googleCalendarRepository, calendarRepository } from '../src/core/db/repositories';
import { db } from '../src/core/db/schema';
import { mergeEventSources, localDateTimeISO, todayKey } from '../src/core/engines/calendarEngine';
import { exportAll, importAll, deleteAllData } from '../src/utils/backup';
import { usePlanningStore } from '../src/core/store/usePlanningStore';
import type { CalendarEvent } from '../src/core/types';

/** جلب وهمي يعيد قائمة أحداث خام */
function fakeFetcher(items: unknown[], opts: { ok?: boolean; status?: number } = {}) {
  const fn = vi.fn(async () => ({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: async () => ({ items })
  }));
  return fn as unknown as GoogleFetcher & ReturnType<typeof vi.fn>;
}

const TIMED_EVENT = {
  id: 'evt-1',
  status: 'confirmed',
  summary: 'حلقة ذكر',
  location: 'المسجد',
  start: { dateTime: '2026-03-05T08:00:00.000Z' },
  end: { dateTime: '2026-03-05T09:00:00.000Z' },
  updated: '2026-03-01T10:00:00.000Z'
};

const ALL_DAY_EVENT = {
  id: 'evt-2',
  status: 'confirmed',
  summary: 'رحلة عائلية',
  start: { date: '2026-03-05' },
  end: { date: '2026-03-07' }
};

beforeEach(async () => {
  await db.delete();
  await db.open();
  clearGoogleAccessToken();
  usePlanningStore.setState({ tasks: [], events: [], replanResult: null, googleEvents: [], googleSyncAt: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('mapGoogleEvent — تحويل للقراءة فقط', () => {
  it('حدث بوقت: ثابت بمصدر جوجل + نهاية معرّفة ومعرّف مبادر', () => {
    const mapped = mapGoogleEvent(TIMED_EVENT);
    expect(mapped).not.toBeNull();
    expect(mapped!.id).toBe('gc-evt-1');
    expect(mapped!.kind).toBe('fixed');
    expect(mapped!.source).toBe('google');
    expect(mapped!.allDay).toBe(false);
    expect(mapped!.title).toBe('حلقة ذكر');
    expect(mapped!.note).toBe('المسجد');
    expect(new Date(mapped!.start).getTime()).toBe(Date.parse(TIMED_EVENT.start.dateTime));
    expect(new Date(mapped!.end).getTime()).toBe(Date.parse(TIMED_EVENT.end.dateTime));
  });

  it('بلا نهاية صريحة → ساعة واحدة من البداية (كي لا ينفجر العرض)', () => {
    const mapped = mapGoogleEvent({ id: 'x', start: { dateTime: '2026-03-05T08:00:00.000Z' } })!;
    expect(new Date(mapped.end).getTime() - new Date(mapped.start).getTime()).toBe(60 * 60 * 1000);
  });

  it('نهاية قبل البداية → تُهمَّد وتُستبدل بمدة افتراضية', () => {
    const mapped = mapGoogleEvent({
      id: 'x',
      start: { dateTime: '2026-03-05T08:00:00.000Z' },
      end: { dateTime: '2026-03-05T07:00:00.000Z' }
    })!;
    expect(new Date(mapped.end).getTime()).toBe(new Date(mapped.start).getTime() + 60 * 60 * 1000);
  });

  it('حدث طوال اليوم: بداية منتصف الليل ونهايته في اليوم التالي (جوجل حصرية)', () => {
    const mapped = mapGoogleEvent(ALL_DAY_EVENT)!;
    expect(mapped.allDay).toBe(true);
    expect(mapped.start).toBe(localDateTimeISO('2026-03-05', '00:00'));
    expect(mapped.end).toBe(localDateTimeISO('2026-03-07', '00:00'));
  });

  it('يوم واحد بلا end.date → ينتهي في منتصف ليل اليوم التالي', () => {
    const mapped = mapGoogleEvent({ id: 'd', start: { date: '2026-03-05' } })!;
    expect(mapped.allDay).toBe(true);
    expect(mapped.end).toBe(localDateTimeISO('2026-03-06', '00:00'));
  });

  it('بلا اسم → نص عرض محايد', () => {
    expect(mapGoogleEvent({ id: 'n', summary: '   ', start: { date: '2026-03-05' } })!.title).toBe('حدث في تقويمي');
  });

  it('ملغى أو بلا معرّف أو بلا بداية → null (لا يظهر أبدًا)', () => {
    expect(mapGoogleEvent({ ...TIMED_EVENT, status: 'cancelled' })).toBeNull();
    expect(mapGoogleEvent({ ...TIMED_EVENT, id: undefined })).toBeNull();
    expect(mapGoogleEvent({ id: 'z' })).toBeNull();
    expect(mapGoogleEvent({ id: 'z', start: { dateTime: 'not-a-date' } })).toBeNull();
  });

  it('النطاق المستخدم قراءة فقط فعلًا', () => {

describe('النطاق الزمني والجلب', () => {
  it('نافذة المزامنة تبدأ من منتصف ليل اليوم المحلي وتمتد 90 يومًا', () => {
    const { timeMin, timeMax } = defaultSyncWindow(new Date());
    expect(timeMin).toBe(localDateTimeISO(todayKey(), '00:00'));
    expect((Date.parse(timeMax) - Date.parse(timeMin)) / 86400000).toBe(90);
  });

  it('fetchGoogleEvents يرسل التفويض والنطاق ويقرأ items', async () => {
    const fetcher = fakeFetcher([TIMED_EVENT]);
    const items = await fetchGoogleEvents({
      accessToken: 'tok-123',
      timeMin: '2026-03-01T00:00:00.000Z',
      timeMax: '2026-06-01T00:00:00.000Z',
      fetchImpl: fetcher
    });
    expect(items).toHaveLength(1);
    const [url, init] = fetcher.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toContain('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    expect(url).toContain('singleEvents=true');
    expect(url).toContain('orderBy=startTime');
    expect(url).toContain(encodeURIComponent('2026-03-01T00:00:00.000Z'));
    expect(init.headers.Authorization).toBe('Bearer tok-123');
  });

  it('استجابة غير ناجحة → خطأ صريح (الواجهة تعرضه بلطف)', async () => {
    const failing: GoogleFetcher = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(
      fetchGoogleEvents({ accessToken: 't', timeMin: 'a', timeMax: 'b', fetchImpl: failing })
    ).rejects.toThrow(/401/);
  });

  it('رد بلا items → مصفوفة فاضية بلا انهيار', async () => {
    const empty: GoogleFetcher = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    await expect(
      fetchGoogleEvents({ accessToken: 't', timeMin: 'a', timeMax: 'b', fetchImpl: empty })
    ).resolves.toEqual([]);
  });

  it('syncGoogleCalendar يستبعد الملغى ويرتّب بالوقت', async () => {
    const result = await syncGoogleCalendar({
      accessToken: 'tok',
      timeMin: '2026-03-01T00:00:00.000Z',
      timeMax: '2026-06-01T00:00:00.000Z',
      fetchImpl: fakeFetcher([
        { id: 'late', start: { dateTime: '2026-05-20T10:00:00.000Z' }, end: { dateTime: '2026-05-20T11:00:00.000Z' } },
        { id: 'early', start: { dateTime: '2026-03-02T10:00:00.000Z' }, end: { dateTime: '2026-03-02T11:00:00.000Z' } },
        { id: 'gone', status: 'cancelled', start: { dateTime: '2026-03-02T09:00:00.000Z' } }
      ])
    });
    expect(result.events.map((e) => e.id)).toEqual(['gc-early', 'gc-late']);
    expect(result.timeMin).toBe('2026-03-01T00:00:00.000Z');
    expect(result.timeMax).toBe('2026-06-01T00:00:00.000Z');
    expect(Date.parse(result.syncedAt)).toBeGreaterThan(0);
  });
});

describe('مخزن الرمز — ذاكرة فقط', () => {
  it('رمز صالح → متصل، ورمز قصير العمر يسقط بهامش الدقيقة', () => {
    setGoogleAccessToken('tok', 3600);
    expect(getGoogleAccessToken()).toBe('tok');
    expect(isGoogleCalendarConnected()).toBe(true);

    clearGoogleAccessToken();
    expect(getGoogleAccessToken()).toBeNull();
    expect(isGoogleCalendarConnected()).toBe(false);

    setGoogleAccessToken('short', 30); // أقل من هامش الأمان (60 ثانية)
    expect(getGoogleAccessToken()).toBeNull();
  });

  it('syncWithStoredToken بلا رمز → خطأ واضح ولا طلب شبكة', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    await expect(syncWithStoredToken()).rejects.toThrow('google_calendar_not_connected');
    expect(spy).not.toHaveBeenCalled();
  });

  it('syncWithStoredToken برمز صالح يستخدمه في الطلب', async () => {
    setGoogleAccessToken('tok-9', 3600);
    const fetcher = fakeFetcher([TIMED_EVENT]);
    const result = await syncWithStoredToken(fetcher);
    expect(result.events).toHaveLength(1);
    const [, init] = fetcher.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe('Bearer tok-9');
  });
});

    expect(GOOGLE_CALENDAR_SCOPE).toBe('https://www.googleapis.com/auth/calendar.readonly');
  });
});

describe('googleCalendarRepository — الكاش المحلي', () => {
  it('الكاش موجود في المخطط الحالي', () => {
    expect(db.tables.map((t) => t.name)).toContain('googleEventsCache');
  });

  it('replaceAll يستبدل المحتوى بالكامل (ذرّي)', async () => {
    const first = mapGoogleEvent(TIMED_EVENT)!;
    await googleCalendarRepository.replaceAll([first]);
    expect(await googleCalendarRepository.count()).toBe(1);

    const second = mapGoogleEvent(ALL_DAY_EVENT)!;
    expect(await googleCalendarRepository.replaceAll([second, first])).toBe(2);
    const all = await googleCalendarRepository.getAll();
    expect(all.map((e) => e.id).sort()).toEqual(['gc-evt-1', 'gc-evt-2']);

    expect(await googleCalendarRepository.replaceAll([])).toBe(0);
    expect(await googleCalendarRepository.count()).toBe(0);
  });

  it('getBetween يرجع أحداث النطاق فقط', async () => {
    await googleCalendarRepository.replaceAll([mapGoogleEvent(TIMED_EVENT)!]);
    const inRange = await googleCalendarRepository.getBetween('2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');
    expect(inRange).toHaveLength(1);
    const out = await googleCalendarRepository.getBetween('2027-01-01T00:00:00.000Z', '2027-02-01T00:00:00.000Z');
    expect(out).toHaveLength(0);
  });

  it('لا يخلط الأحداث المحلية ولا يدخل النسخ الاحتياطية', async () => {
    await calendarRepository.create({
      title: 'حدث محلي',
      kind: 'fixed',
      start: localDateTimeISO(todayKey(), '09:00'),
      end: localDateTimeISO(todayKey(), '10:00')
    } as unknown as CalendarEvent);

    await googleCalendarRepository.replaceAll([mapGoogleEvent(TIMED_EVENT)!]);

    const snapshot = await exportAll();
    expect(Object.keys(snapshot.data)).not.toContain('googleEventsCache');
    expect((snapshot.data as Record<string, unknown[]>).calendarEvents).toHaveLength(1);

    // الاستيراد يمسح الكاش (بيانات جوجل تُعاد مزامنتها) ولا يمسّ المحلية
    await importAll(snapshot);
    expect(await googleCalendarRepository.count()).toBe(0);
    expect(await calendarRepository.getAll()).toHaveLength(1);

    await deleteAllData();
    expect(await calendarRepository.getAll()).toHaveLength(0);
    expect(await googleCalendarRepository.count()).toBe(0);
  });
});

describe('mergeEventSources — عرض المصدرين معًا', () => {
  const mk = (over: Partial<CalendarEvent>): CalendarEvent => ({
    id: 'e',
    title: 'حدث',
    kind: 'fixed',
    start: '2026-03-05T09:00:00.000Z',
    end: '2026-03-05T10:00:00.000Z',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...over
  });

  it('يدمج ويرتّب بالوقت ثم الاسم ويحفظ راية المصدر', () => {
    const merged = mergeEventSources(
      [mk({ id: 'l2', title: 'ب', start: '2026-03-06T09:00:00.000Z', source: 'local' })],
      [
        mk({ id: 'g1', title: 'أ', start: '2026-03-05T09:00:00.000Z', source: 'google' }),
        mk({ id: 'g2', title: 'ج', start: '2026-03-07T09:00:00.000Z', source: 'google' })
      ]
    );
    expect(merged.map((e) => e.id)).toEqual(['g1', 'l2', 'g2']);
    expect(merged[0].source).toBe('google');
  });

  it('قوائم فاضية → مصفوفة فاضية (ولا يُخلق شيء)', () => {
    expect(mergeEventSources([], [])).toEqual([]);
  });
});

describe('usePlanningStore.syncGoogle — المزامنة عبر المتجر', () => {
  it('يكتب الكاش ويحدّث الحالة ويعيد العدد', async () => {
    setGoogleAccessToken('tok', 3600);
    vi.stubGlobal('fetch', fakeFetcher([TIMED_EVENT, ALL_DAY_EVENT, { id: 'gone', status: 'cancelled' }]));

    const count = await usePlanningStore.getState().syncGoogle();
    expect(count).toBe(2);
    expect(usePlanningStore.getState().googleEvents.map((e) => e.id).sort()).toEqual(['gc-evt-1', 'gc-evt-2']);
    expect(usePlanningStore.getState().googleSyncAt).toBeTruthy();
    expect(await googleCalendarRepository.count()).toBe(2);
    // أحداث جوجل لا تسرّب أبدًا إلى جدول الأحداث المحلية
    expect(await calendarRepository.getAll()).toHaveLength(0);
  });

  it('load يقرأ الكاش من قاعدة البيانات', async () => {
    await googleCalendarRepository.replaceAll([mapGoogleEvent(TIMED_EVENT)!]);
    await usePlanningStore.getState().load();
    expect(usePlanningStore.getState().googleEvents).toHaveLength(1);
  });

  it('disconnectGoogle يفرّغ الكاش والحالة ويمسح الرمز', async () => {
    setGoogleAccessToken('tok', 3600);
    vi.stubGlobal('fetch', fakeFetcher([TIMED_EVENT]));
    await usePlanningStore.getState().syncGoogle();
    expect(usePlanningStore.getState().googleEvents).toHaveLength(1);

    await usePlanningStore.getState().disconnectGoogle();
    expect(usePlanningStore.getState().googleEvents).toEqual([]);
    expect(usePlanningStore.getState().googleSyncAt).toBeNull();
    expect(await googleCalendarRepository.count()).toBe(0);
    expect(isGoogleCalendarConnected()).toBe(false);
  });

  it('فشل الجلب يرمي خطأ ولا يمسح الكاش السابق', async () => {
    setGoogleAccessToken('tok', 3600);
    vi.stubGlobal('fetch', fakeFetcher([TIMED_EVENT]));
    await usePlanningStore.getState().syncGoogle();

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(usePlanningStore.getState().syncGoogle()).rejects.toThrow(/500/);
    expect(await googleCalendarRepository.count()).toBe(1);
  });
});

