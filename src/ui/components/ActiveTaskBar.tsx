// ============================================================
// رِفق — Active Task Bar (شريط المهمة الجارية + مؤقت التركيز)
// حلقة تقدم دائرية + خط تقدم — صغير وهادئ، يظهر فقط مع مهمة جارية.
// × = إخفاء مؤقت فقط · ⏸ = إيقاف يجمد العد بدقة.
// عرض فقط — المنطق كله في useActiveTaskStore.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { remainingMs, useActiveTaskStore } from '../../core/store/useActiveTaskStore';
import { voice } from '../../i18n/voice';

/** تنسيق الميلي ثانية: m:ss أو h:mm:ss */
function fmt(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function ActiveTaskBar() {
  const active = useActiveTaskStore((s) => s.active);
  const loaded = useActiveTaskStore((s) => s.loaded);
  const hidden = useActiveTaskStore((s) => s.hidden);
  const pending = useActiveTaskStore((s) => s.pending);
  const timer = useActiveTaskStore((s) => s.timer);
  const load = useActiveTaskStore((s) => s.load);
  const completeActive = useActiveTaskStore((s) => s.completeActive);
  const dismiss = useActiveTaskStore((s) => s.dismiss);
  const unhide = useActiveTaskStore((s) => s.unhide);
  const confirmReplace = useActiveTaskStore((s) => s.confirmReplace);
  const cancelPending = useActiveTaskStore((s) => s.cancelPending);
  const pauseTimer = useActiveTaskStore((s) => s.pauseTimer);
  const resumeTimer = useActiveTaskStore((s) => s.resumeTimer);
  const logSession = useActiveTaskStore((s) => s.logSession);
  const clearTimer = useActiveTaskStore((s) => s.clearTimer);

  // نبضة كل ثانية — للمؤقت فقط (لا تشغيل زائد بدونه)
  const [now, setNow] = useState(() => Date.now());
  const running = Boolean(timer && !timer.pausedAt);
  useEffect(() => {
    void load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void load();
        setNow(Date.now());
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const left = useMemo(() => (timer ? remainingMs(timer, now) : 0), [timer, now]);
  const timeUp = Boolean(timer && left <= 0);
  const remainingPct = timer && timer.plannedMinutes > 0
    ? Math.round((left / (timer.plannedMinutes * 60_000)) * 100)
    : 0;

  if (!loaded || !active) return null;

  if (hidden) {
    // مخفية مؤقتًا — زر مصغر جدًا لإرجاع الشريط (المهمة مستمرة في الخلفية)
    return (
      <button
        className="active-task-restore"
        aria-label={voice.activeTask.restore}
        title={voice.activeTask.restore}
        onClick={unhide}
      >
        ▶
      </button>
    );
  }

  if (pending) {
    return (
      <div className="active-task-bar" role="alertdialog" aria-live="polite">
        <div className="active-task-pending">
          <span className="active-task-question">
            {voice.activeTask.replaceQuestion
              .replace('{current}', active.title)
              .replace('{next}', pending.title)}
          </span>
          <div className="active-task-actions">
            <button className="at-btn at-btn-primary" onClick={() => void confirmReplace()}>
              {voice.activeTask.replace}
            </button>
            <button className="at-btn at-btn-ghost" onClick={cancelPending}>
              {voice.activeTask.back}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (timeUp) {
    // خلص الوقت — هدوء: سجّلي الجلسة أو كمّلي
    return (
      <div className="active-task-bar is-up" role="status">
        <span className="active-task-up-label">{voice.activeTask.timeUp}</span>
        <div className="active-task-actions">
          {active.kind === 'learning' && (
            <button className="at-btn at-btn-primary" onClick={() => void logSession()}>
              {voice.activeTask.logSession}
            </button>
          )}
          <button
            className="at-btn at-btn-done"
            aria-label={voice.common.complete}
            onClick={() => void completeActive()}
          >
            ✓
          </button>
          <button className="at-btn at-btn-ghost" onClick={clearTimer}>
            {voice.activeTask.keepGoing}
          </button>
        </div>
      </div>
    );
  }

  const paused = Boolean(timer?.pausedAt);

  return (
    <div className={`active-task-bar${paused ? ' is-paused' : ''}`} role="status">
      <div className="active-task-main">
        {timer && (
          <div
            className="timer-ring"
            style={{ '--p': `${remainingPct}%` } as React.CSSProperties}
            aria-hidden="true"
          >
            <span className="timer-text">
              {paused ? '⏸' : fmt(left)}
            </span>
          </div>
        )}
        <div className="active-task-info">
          <span className="active-task-title">{active.title}</span>
          {paused && <span className="active-task-chip">{voice.activeTask.paused}</span>}
          {timer && (
            <div className="timer-line" aria-hidden="true">
              <span style={{ width: `${remainingPct}%` }} />
            </div>
          )}
        </div>
        <div className="active-task-actions">
          {timer && (
            <button
              className="at-btn"
              aria-label={paused ? voice.activeTask.resume : voice.activeTask.pause}
              title={paused ? voice.activeTask.resume : voice.activeTask.pause}
              onClick={() => (paused ? resumeTimer() : pauseTimer())}
            >
              {paused ? '⏵' : '⏸'}
            </button>
          )}
          <button
            className="at-btn at-btn-done"
            aria-label={voice.common.complete}
            title={voice.common.complete}
            onClick={() => void completeActive()}
          >
            ✓
          </button>
          <button
            className="at-btn at-btn-ghost"
            aria-label={voice.activeTask.hide}
            title={voice.activeTask.hide}
            onClick={dismiss}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
