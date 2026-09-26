// @vitest-environment jsdom
// ============================================================
// رِفق — اختبارات واجهة Google Calendar (قراءة فقط)
// 1) الإعدادات: بلا client id ← رسالة إعداد بلا أزرار ميتة
// 2) الربط: رمز → مزامنة أولى → الكاش يمتلئ والبانر يطمن
// 3) فشل المزامنة ← رسالة لطيفة والكاش القديم باقٍ
// 4) فك الربط ← تفريغ الكاش والعودة لزر الربط
// 5) التقويم: حدث جوجل بشارة Google ولون مختلف وبلا زر حذف
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPage } from '../../src/ui/screens/system/SettingsPage';
import { PlanningPage } from '../../src/ui/screens/planning/PlanningPage';
import { usePlanningStore } from '../../src/core/store/usePlanningStore';
import { googleCalendarRepository, calendarRepository } from '../../src/core/db/repositories';
import { db } from '../../src/core/db/schema';
import { localDateTimeISO, todayKey } from '../../src/core/engines/calendarEngine';
import { voice } from '../../src/i18n/voice';
import type { CalendarEvent } from '../../src/core/types';

const S = voice.system;
const cal = voice.planning.calendar;

/** التحكم في طبقة التكامل (OAuth + الشبكة) — الواجهة فقط تحت الاختبار هنا */
const h = vi.hoisted(() => {
  const events: CalendarEvent[] = [];
  return {
    configured: false,
    connected: false,
    events,
    requestToken: vi.fn(async () => 'tok-test'),
    sync: vi.fn(async () => ({
      events,
      timeMin: '2026-01-01T00:00:00.000Z',
      timeMax: '2027-01-01T00:00:00.000Z',
      syncedAt: new Date().toISOString()
    })),
    disconnect: vi.fn(async () => {})
  };
});

vi.mock('../../src/core/integrations/googleCalendar', () => ({
  GOOGLE_CALENDAR_SCOPE: 'https://www.googleapis.com/auth/calendar.readonly',
  isGoogleCalendarConfigured: () => h.configured,
  isGoogleCalendarConnected: () => h.connected,
  requestGoogleAccessToken: h.requestToken,
  clearGoogleAccessToken: vi.fn(),
  syncWithStoredToken: h.sync,
  disconnectGoogleCalendar: h.disconnect
}));

/** حدث من جوجل جاهز للكاش */
function googleEvent(title: string, hour = 9): CalendarEvent {
  return {
    id: `gc-${title}`,
    title,
    kind: 'fixed',
    start: localDateTimeISO(todayKey(), `${String(hour).padStart(2, '0')}:00`),
    end: localDateTimeISO(todayKey(), `${String(hour + 1).padStart(2, '0')}:00`),
    source: 'google',
    allDay: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  h.configured = false;
  h.connected = false;
  h.events.length = 0;
  h.requestToken.mockClear();
  h.sync.mockClear();
  h.disconnect.mockClear();
  usePlanningStore.setState({ tasks: [], events: [], replanResult: null, googleEvents: [], googleSyncAt: null });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Settings — بطاقة Google Calendar', () => {
  it('بلا VITE_GOOGLE_CLIENT_ID ← رسالة إعداد صريحة وبلا زر ربط', async () => {
    h.configured = false;
    render(<SettingsPage />);

    expect(await screen.findByText(/Google Calendar/)).toBeDefined();
    expect(screen.getByText(S.googleNotConfigured)).toBeDefined();
    expect(screen.queryByRole('button', { name: S.googleConnect })).toBeNull();
  });

  it('ربط ناجح ← مزامنة أولى تملأ الكاش والبانر يطمئن', async () => {
    h.configured = true;
    h.events.push(googleEvent('لقاء الأسرة'));
    render(<SettingsPage />);

    await userEvent.click(await screen.findByRole('button', { name: S.googleConnect }));

    await waitFor(() => {
      expect(screen.getByText(S.googleSyncDone.replace('{count}', '1'))).toBeDefined();
    });
    expect(h.requestToken).toHaveBeenCalledTimes(1);
    expect(h.sync).toHaveBeenCalledTimes(1);
    expect(usePlanningStore.getState().googleEvents.map((e) => e.id)).toEqual(['gc-لقاء الأسرة']);
    expect(await googleCalendarRepository.count()).toBe(1);

    // البطاقة انتقلت لحالة "متصل" مع أزرار المزامنة وفك الربط
    expect(await screen.findByText(S.googleConnected)).toBeDefined();
    expect(screen.getByRole('button', { name: S.googleSync })).toBeDefined();
    expect(screen.getByRole('button', { name: S.googleDisconnect })).toBeDefined();
    expect(screen.getByText(S.googleEventsCount.replace('{count}', '1'))).toBeDefined();
  });

  it('فشل المزامنة بعد الربط ← رسالة لطيفة والكاش القديم باقٍ', async () => {
    h.configured = true;
    await googleCalendarRepository.replaceAll([googleEvent('قديم')]);
    h.sync.mockRejectedValue(new Error('network'));

    render(<SettingsPage />);
    await userEvent.click(await screen.findByRole('button', { name: S.googleConnect }));

    await waitFor(() => {
      expect(screen.getByText(S.errorGeneric)).toBeDefined();
    });
    // لا مسح للبيانات عند الفشل — الأحداث السابقة تبقى معروضة
    expect(await googleCalendarRepository.count()).toBe(1);
    expect(usePlanningStore.getState().googleEvents).toEqual([]);
  });

  it('فك الربط ← تفريغ الكاش والعودة لزر الربط', async () => {
    h.configured = true;
    h.connected = true;
    h.events.push(googleEvent('ihi'));
    await googleCalendarRepository.replaceAll([googleEvent('ihi')]);
    usePlanningStore.setState({ googleEvents: [googleEvent('ihi')], googleSyncAt: new Date().toISOString() });

    render(<SettingsPage />);
    await userEvent.click(await screen.findByRole('button', { name: S.googleDisconnect }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: S.googleConnect })).toBeDefined();
    });
    expect(h.disconnect).toHaveBeenCalledTimes(1);
    expect(usePlanningStore.getState().googleEvents).toEqual([]);
    expect(usePlanningStore.getState().googleSyncAt).toBeNull();
    expect(await googleCalendarRepository.count()).toBe(0);
  });
});


describe('التقويم — أحداث جوجل مع الأحداث المحلية', () => {
  it('تبويب اليوم: حدث جوجل بشارة Google وبلا زر حذف، والمحلية بزر حذف', async () => {
    await googleCalendarRepository.replaceAll([googleEvent('موعد الطبي', 11)]);
    await calendarRepository.create({
      id: 'local-1',
      title: 'مذاكرة سورة',
      kind: 'fixed',
      start: localDateTimeISO(todayKey(), '06:00'),
      end: localDateTimeISO(todayKey(), '07:00'),
      source: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as unknown as CalendarEvent);

    render(<PlanningPage />);
    await userEvent.click(await screen.findByRole('tab', { name: cal.tabs.day }));

    // الحدثان ظهرا في نفس اليوم
    expect(await screen.findByText('موعد الطبي')).toBeDefined();
    expect(screen.getByText('مذاكرة سورة')).toBeDefined();

    // حدث جوجل: شارة Google، والمحلي فقط يحمل شارة «ثابت»
    expect(screen.getAllByText(cal.googleLabel)).toHaveLength(1);
    expect(screen.getAllByText(cal.kindLabels.fixed)).toHaveLength(1);

    // الحذف متاح للمحلي فقط (أحداث جوجل قراءة فقط)
    expect(screen.getAllByLabelText(voice.common.delete)).toHaveLength(1);

    // الترتيب بالوقت: المحلي 06:00 قبل جوجل 11:00
    const titles = [...document.querySelectorAll('.event-title')].map((el) => el.textContent);
    expect(titles).toEqual(['مذاكرة سورة', 'موعد الطبي']);

    // صفّ حدث جوجل يحمل الصنف المميز ev-google
    const googleRow = document.querySelector('.event-row.ev-google');
    expect(googleRow).not.toBeNull();
    expect(googleRow?.textContent).toContain('موعد الطبي');
  });

  it('حدث طوال اليوم من جوجل ← "طوال اليوم" بدل الوقت', async () => {
    await googleCalendarRepository.replaceAll([{ ...googleEvent('يوم ضيافة'), allDay: true }]);
    render(<PlanningPage />);
    await userEvent.click(await screen.findByRole('tab', { name: cal.tabs.day }));

    expect(await screen.findByText('يوم ضيافة')).toBeDefined();
    expect(screen.getByText(cal.allDayLabel)).toBeDefined();
  });

  it('بلا مزامنة (كاش فاضي) ← العرض كما كان ولا شارة جوجل', async () => {
    render(<PlanningPage />);
    await userEvent.click(await screen.findByRole('tab', { name: cal.tabs.day }));
    expect(await screen.findByText(cal.emptyDay)).toBeDefined();
    expect(screen.queryByText(cal.googleLabel)).toBeNull();
  });
});
