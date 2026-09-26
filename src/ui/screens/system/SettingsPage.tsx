// ============================================================
// رِفق — Screen: النظام (Settings / ملكية البيانات)
// نسخة احتياطية · استيراد بتأكيد صريح · حذف كل البيانات بتأكيد مزدوج.
// المنطق كله في src/utils/backup.ts — الصفحة عرض + تأكيد فقط.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { CURRENT_SCHEMA_VERSION } from '../../../core/db/schema';
import {
  deleteAllData,
  downloadJSON,
  exportAll,
  importAll,
  isVersionSupported
} from '../../../utils/backup';
import type { BackupSnapshot } from '../../../core/types';
import {
  isGoogleCalendarConfigured,
  isGoogleCalendarConnected,
  requestGoogleAccessToken
} from '../../../core/integrations/googleCalendar';
import { usePlanningStore } from '../../../core/store/usePlanningStore';
import { voice } from '../../../i18n/voice';
import { Button, Card } from '../../components';

const S = voice.system;

type Note = { text: string; tone: 'ok' | 'error' };

/** جداول النسخة الاحتياطية — بالترتيب نفسه وبأسماء عربية للتعداد */
const COUNT_KEYS = [
  'tasks',
  'calendarEvents',
  'paths',
  'pathItems',
  'sessions',
  'reflections',
  'energyCheckins',
  'shariaTexts',
  'prayerAnchors',
  'settings'
] as const;

interface CountRow {
  key: string;
  label: string;
  value: number;
}

function countsOf(snapshot: BackupSnapshot): CountRow[] {
  return COUNT_KEYS.map((key) => ({
    key,
    label: S.counts[key] ?? key,
    value: snapshot.data[key]?.length ?? 0
  }));
}

/** قراءة ملف النسخة والتحقق من شكله — بلا رمي أخطاء */
function parseSnapshot(text: string): BackupSnapshot | null {
  try {
    const parsed = JSON.parse(text) as Partial<BackupSnapshot> | null;
    if (!parsed || typeof parsed.schemaVersion !== 'number' || !parsed.data) return null;
    return parsed as BackupSnapshot;
  } catch {
    return null;
  }
}

export function SettingsPage() {
  const [note, setNote] = useState<Note | null>(null);
  const [rows, setRows] = useState<CountRow[]>([]);
  const [busy, setBusy] = useState<null | 'export' | 'import' | 'delete'>(null);
  /** نسخة في انتظار تأكيد الاستيراد — لا يُمس شيء قبل التأكيد */
  const [pending, setPending] = useState<BackupSnapshot | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [askDelete, setAskDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ===== Google Calendar — قراءة فقط (الرمز في الذاكرة ولا يُخزَّن أبدًا) =====
  const googleEvents = usePlanningStore((s) => s.googleEvents);
  const googleSyncAt = usePlanningStore((s) => s.googleSyncAt);
  const syncGoogle = usePlanningStore((s) => s.syncGoogle);
  const disconnectGoogle = usePlanningStore((s) => s.disconnectGoogle);
  const [googleBusy, setGoogleBusy] = useState<null | 'connect' | 'sync' | 'disconnect'>(null);
  const [googleConnected, setGoogleConnected] = useState(isGoogleCalendarConnected());
  const googleConfigured = isGoogleCalendarConfigured();

  const refreshInfo = useCallback(async () => {
    try {
      setRows(countsOf(await exportAll()));
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void refreshInfo();
  }, [refreshInfo]);

  const handleExport = async () => {
    setBusy('export');
    setNote(null);
    try {
      const snapshot = await exportAll();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJSON(JSON.stringify(snapshot, null, 2), `refq-backup-${stamp}.json`);
      setNote({ text: S.exportDone, tone: 'ok' });
    } catch {
      setNote({ text: S.errorGeneric, tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const handleFile = async (file: File) => {
    setNote(null);
    setAskDelete(false);
    let text = '';
    try {
      text = await file.text();
    } catch {
      setNote({ text: S.importInvalid, tone: 'error' });
      return;
    }
    const snapshot = parseSnapshot(text);
    if (!snapshot) {
      setNote({ text: S.importInvalid, tone: 'error' });
      return;
    }
    if (!isVersionSupported(snapshot.schemaVersion)) {
      setNote({
        text: S.importUnsupported.replace('{version}', String(snapshot.schemaVersion)),
        tone: 'error'
      });
      return;
    }
    setPendingName(file.name);
    setPending(snapshot);
  };

  const confirmImport = async () => {
    if (!pending) return;
    setBusy('import');
    try {
      const tables = await importAll(pending);
      setNote({ text: S.importDone.replace('{tables}', String(tables.length)), tone: 'ok' });
      setPending(null);
      setPendingName('');
      await refreshInfo();
    } catch {
      setNote({ text: S.errorGeneric, tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    setBusy('delete');
    try {
      await deleteAllData();
      setNote({ text: S.dangerDone, tone: 'ok' });
      setAskDelete(false);
      await refreshInfo();
    } catch {
      setNote({ text: S.errorGeneric, tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  /** الربط: نافذة جوجل → رمز في الذاكرة فقط → مزامنة أولى تلقائية */
  const handleGoogleConnect = async () => {
    setGoogleBusy('connect');
    setNote(null);
    try {
      await requestGoogleAccessToken();
      setGoogleConnected(true);
      const count = await syncGoogle();
      setNote({ text: S.googleSyncDone.replace('{count}', String(count)), tone: 'ok' });
    } catch {
      setNote({ text: S.errorGeneric, tone: 'error' });
    } finally {
      setGoogleBusy(null);
    }
  };

  /** مزامنة يدوية: جلب النطاق الزمني واستبدال الكاش المحلي */
  const handleGoogleSync = async () => {
    setGoogleBusy('sync');
    setNote(null);
    try {
      const count = await syncGoogle();
      setNote({ text: S.googleSyncDone.replace('{count}', String(count)), tone: 'ok' });
    } catch {
      setNote({ text: S.errorGeneric, tone: 'error' });
    } finally {
      setGoogleBusy(null);
    }
  };

  /** فك الربط: محو الرمز من الذاكرة + تفريغ الأحداث المعروضة */
  const handleGoogleDisconnect = async () => {
    setGoogleBusy('disconnect');
    try {
      await disconnectGoogle();
      setGoogleConnected(false);
      setNote(null);
    } catch {
      setNote({ text: S.errorGeneric, tone: 'error' });
    } finally {
      setGoogleBusy(null);
    }
  };

  const googleLastSync = googleSyncAt
    ? S.googleLastSync.replace('{time}', new Date(googleSyncAt).toLocaleString())
    : S.googleNeverSynced;

  return (
    <section className="screen">
      <h2 className="screen-title">{S.title}</h2>
      <p className="muted">{S.backupHint}</p>

      {note && (
        <div
          className={`banner ${note.tone === 'error' ? 'banner-error' : 'banner-gentle'}`}
          role="status"
        >
          <p>{note.text}</p>
        </div>
      )}

      <Card title={S.exportTitle} icon="📥">
        <p className="muted">{S.exportHint}</p>
        <div className="banner-actions">
          <Button onClick={() => void handleExport()} disabled={busy !== null}>
            {S.exportButton}
          </Button>
        </div>
      </Card>

      <Card title={S.importTitle} icon="📤">
        <p className="muted">{S.importHint}</p>
        {pending ? (
          <div className="add-form">
            <p className="section-divider">{S.importConfirmQuestion}</p>
            <p className="muted">{pendingName}</p>
            <div className="banner-actions">
              <Button onClick={() => void confirmImport()} disabled={busy !== null}>
                {S.importConfirm}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPending(null);
                  setPendingName('');
                }}
              >
                {S.importCancel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="banner-actions">
            <input
              ref={fileRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              aria-label={S.importButton}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />
            <Button variant="soft" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
              {S.importButton}
            </Button>
          </div>
        )}
      </Card>

      <Card title={S.googleTitle} icon="🗓️">
        <p className="muted">{S.googleHint}</p>
        {!googleConfigured ? (
          <div className="banner-actions">
            <p className="section-divider">{S.googleNotConfigured}</p>
          </div>
        ) : !googleConnected ? (
          <div className="banner-actions">
            <Button onClick={() => void handleGoogleConnect()} disabled={googleBusy !== null}>
              {googleBusy === 'connect' ? S.googleConnecting : S.googleConnect}
            </Button>
          </div>
        ) : (
          <div className="add-form">
            <p className="section-divider">{S.googleConnected}</p>
            <p className="muted">{googleLastSync}</p>
            <p className="muted">
              {googleEvents.length > 0
                ? S.googleEventsCount.replace('{count}', String(googleEvents.length))
                : S.googleNoEvents}
            </p>
            <div className="banner-actions">
              <Button variant="soft" onClick={() => void handleGoogleSync()} disabled={googleBusy !== null}>
                {googleBusy === 'sync' ? S.googleSyncing : S.googleSync}
              </Button>
              <Button variant="ghost" onClick={() => void handleGoogleDisconnect()} disabled={googleBusy !== null}>
                {S.googleDisconnect}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card title={S.dangerTitle} icon="🗑">
        <p className="muted">{S.dangerHint}</p>
        {askDelete ? (
          <div className="add-form">
            <p className="section-divider">{S.dangerConfirmQuestion}</p>
            <div className="banner-actions">
              <Button variant="danger" onClick={() => void confirmDelete()} disabled={busy !== null}>
                {S.dangerConfirm}
              </Button>
              <Button variant="ghost" onClick={() => setAskDelete(false)}>
                {S.dangerCancel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="banner-actions">
            <Button
              variant="soft"
              onClick={() => {
                setAskDelete(true);
                setNote(null);
              }}
              disabled={busy !== null}
            >
              {S.dangerButton}
            </Button>
          </div>
        )}
      </Card>

      <Card title={S.infoTitle} icon="ℹ️">
        <p className="muted">
          {S.schemaVersion.replace('{version}', String(CURRENT_SCHEMA_VERSION))}
        </p>
        <ul className="count-list">
          {rows.map((r) => (
            <li key={r.key}>
              <span>{r.label}</span>
              <strong>{r.value}</strong>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

