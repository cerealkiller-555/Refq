// ============================================================
// رِفق — عرض التقويم (يوم/أسبوع/شهر) — عرض فقط، المنطق في الـstore والمحركات
// الأسبوع يبدأ السبت (أسبوع عربي)، والثوابت تظهر بلون صريح.
// العرض مُدار من الصفحة (view + anchorKey) — والضغط على أي يوم يفتحه مفصّلًا،
// فتظهر المهام المجدولة والأحداث في مكان واحد بلا توهان.
// ============================================================

import { useMemo, useState } from 'react';
import { usePlanningStore, todayKey } from '../../../core/store/usePlanningStore';
import {
  eventsForDay,
  eventsForWeek,
  eventsForMonth,
  groupTasksByDay,
  weekDayKeys,
  weekStartKey,
  addDaysKey,
  formatEventTime,
  dateKey,
  monthOfKey,
  monthGridKeys,
  mergeEventSources
} from '../../../core/engines/calendarEngine';
import type { CalendarEvent, CalendarEventKind } from '../../../core/types';
import { voice } from '../../../i18n/voice';
import { Button, Card, EmptyState } from '../../components';

const cal = voice.planning.calendar;
const KIND_CLASS: Record<CalendarEventKind, string> = { fixed: 'ev-fixed', flexible: 'ev-flexible' };

type CalendarViewMode = 'day' | 'week' | 'month';

/** الوقت المحلي HH:MM لكل ما هو مجدول */
function timeOf(iso: string | undefined): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** اسم اليوم العربي من مفتاح تاريخ محلي */
function dayNameOf(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00`);
  return cal.dayNames[(d.getDay() + 1) % 7];
}

interface OccLike {
  event: {
    id: string;
    title: string;
    kind: CalendarEventKind;
    source?: 'local' | 'google';
    allDay?: boolean;
  };
  start: string;
  end: string;
}

/** صف_class الحدث — أحداث جوجل تُعلَّم بلون مختلف وتُعرض بلا زر حذف (قراءة فقط) */
function occClass(occ: OccLike): string {
  return `event-row ${KIND_CLASS[occ.event.kind]}${occ.event.source === 'google' ? ' ev-google' : ''}`;
}

/**
 * الأحداث المحلية «المملوكة» — الأحداث المرنة المربوطة بمهمة انعكاسات لها،
 * تمثّلها شريحة المهام في العرض (لا تكرار ولا عدّ مزدوج في التقويم).
 */
function ownLocalEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((e) => !e.linkedTaskId);
}

function EventRow({ occ, onDelete }: { occ: OccLike; onDelete?: (id: string) => void }) {
  const isGoogle = occ.event.source === 'google';
  // الحذف غير قابل للتراجع ← سؤال أولًا ثم تأكيد (نفس نمط «حذف كل البيانات»)
  const [confirming, setConfirming] = useState(false);
  const canDelete = Boolean(onDelete) && !isGoogle;
  return (
    <li className={`${occClass(occ)}${confirming ? ' is-confirming' : ''}`}>
      <span className="event-time">{occ.event.allDay ? cal.allDayLabel : formatEventTime(occ.start, occ.end)}</span>
      <span className="event-title">{occ.event.title}</span>
      <span className="event-kind">{isGoogle ? cal.googleLabel : cal.kindLabels[occ.event.kind]}</span>
      {canDelete && !confirming && (
        <button className="task-delete" aria-label={voice.common.delete} onClick={() => setConfirming(true)}>
          ×
        </button>
      )}
      {canDelete && confirming && (
        <span className="event-confirm">
          <span className="text-xs muted">{cal.deleteEventConfirm}</span>
          <button
            className="task-delete"
            aria-label={voice.common.delete}
            onClick={() => {
              setConfirming(false);
              onDelete?.(occ.event.id);
            }}
          >
            ✓
          </button>
          <button
            className="task-delete"
            aria-label={voice.common.cancel}
            onClick={() => setConfirming(false)}
          >
            ×
          </button>
        </span>
      )}
    </li>
  );
}

function EventForm({ dayKeyStr, onDone }: { dayKeyStr: string; onDone: () => void }) {
  const addOccurrence = usePlanningStore((s) => s.addOccurrence);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<CalendarEventKind>('fixed');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [note, setNote] = useState('');

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    await addOccurrence({
      title: value,
      kind,
      dateKey: dayKeyStr,
      time,
      durationMinutes: duration,
      note: note.trim() || undefined
    });
    setTitle('');
    setNote('');
    onDone();
  };

  return (
    <div className="add-form event-form">
      <input className="text-input" placeholder={cal.eventName} aria-label={cal.eventName} value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} />
      <div className="form-row">
        <div className="form-field">
          <label>{cal.kind}</label>
          <select className="text-input" value={kind} onChange={(e) => setKind(e.target.value as CalendarEventKind)}>
            <option value="fixed">{cal.kindFixed}</option>
            <option value="flexible">{cal.kindFlexible}</option>
          </select>
        </div>
        <div className="form-field">
          <label>{cal.time}</label>
          <input className="text-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="form-field">
          <label>{cal.duration}</label>
          <input className="text-input" type="number" min={5} step={5} value={duration}
            onChange={(e) => setDuration(Math.max(5, parseInt(e.target.value, 10) || 5))} />
        </div>
      </div>
      <input className="text-input" placeholder={cal.note} aria-label={cal.note} value={note}
        onChange={(e) => setNote(e.target.value)} />
      <div className="form-row">
        <Button onClick={() => void submit()}>{cal.save}</Button>
        <Button variant="ghost" onClick={onDone}>{cal.schedule.cancel}</Button>
      </div>
    </div>
  );
}
/** عرض اليوم: أحداث اليوم + مهامه المجدولة في مكان واحد */
function DayView({ dayKeyStr, onOpenDay }: { dayKeyStr: string; onOpenDay: (key: string) => void }) {
  const events = usePlanningStore((s) => s.events);
  const googleEvents = usePlanningStore((s) => s.googleEvents);
  const tasks = usePlanningStore((s) => s.tasks);
  const deleteEvent = usePlanningStore((s) => s.deleteEvent);
  const [showForm, setShowForm] = useState(false);

  const dayEvents = useMemo(
    () => eventsForDay(mergeEventSources(ownLocalEvents(events), googleEvents), dayKeyStr),
    [events, googleEvents, dayKeyStr]
  );
  const dayTasks = useMemo(() => groupTasksByDay(tasks).get(dayKeyStr) ?? [], [tasks, dayKeyStr]);
  const label = `${dayNameOf(dayKeyStr)} ${dayKeyStr}`;

  return (
    <section>
      <div className="day-nav">
        <Button variant="soft" onClick={() => onOpenDay(addDaysKey(dayKeyStr, -1))} ariaLabel={cal.prev}>‹</Button>
        <strong className="day-label">{label}</strong>
        <Button variant="soft" onClick={() => onOpenDay(addDaysKey(dayKeyStr, 1))} ariaLabel={cal.next}>›</Button>
        {dayKeyStr !== todayKey() && <Button variant="ghost" onClick={() => onOpenDay(todayKey())}>{cal.today}</Button>}
      </div>

      {(dayEvents.length > 0 || dayTasks.length > 0) && (
        <p className="day-summary muted">
          {`📋 ${dayTasks.length} ${cal.tasksWord} · 🗓️ ${dayEvents.length} ${cal.eventsWord}`}
        </p>
      )}

      <Card title={cal.addEventTitle} icon="➕">
        {showForm ? (
          <EventForm dayKeyStr={dayKeyStr} onDone={() => setShowForm(false)} />
        ) : (
          <Button variant="soft" onClick={() => setShowForm(true)}>+ {cal.addEventTitle}</Button>
        )}
      </Card>

      <Card>
        {dayEvents.length === 0 ? (
          <EmptyState>{cal.emptyDay}</EmptyState>
        ) : (
          <ul className="event-list">
            {dayEvents.map((occ) => (
              <EventRow key={`${occ.event.id}-${occ.start}`} occ={occ} onDelete={(id) => void deleteEvent(id)} />
            ))}
          </ul>
        )}
      </Card>

      {/* المهام المجدولة في هذا اليوم — تظهر فقط عند وجودها */}
      {dayTasks.length > 0 && (
        <Card title={cal.tasksWord} icon="📋">
          <ul className="event-list">
            {dayTasks.map((task) => (
              <li key={task.id} className="event-chip task-chip">
                <span className="event-time">{timeOf(task.scheduledAt)}</span>
                <span className="event-title">{task.title}</span>
                <span className="event-kind">{cal.scheduledChip}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

/** عرض الأسبوع: 7 أعمدة، وفي كل يوم المهام المجدولة ثم الأحداث */
function WeekView({ anchorKey, onOpenDay }: { anchorKey: string; onOpenDay: (key: string) => void }) {
  const events = usePlanningStore((s) => s.events);
  const googleEvents = usePlanningStore((s) => s.googleEvents);
  const tasks = usePlanningStore((s) => s.tasks);

  const start = weekStartKey(anchorKey);
  const days = useMemo(() => weekDayKeys(start), [start]);
  const allEvents = useMemo(() => mergeEventSources(ownLocalEvents(events), googleEvents), [events, googleEvents]);
  const byDay = useMemo(() => eventsForWeek(allEvents, start), [allEvents, start]);
  const tasksByDay = useMemo(() => groupTasksByDay(tasks), [tasks]);

  const countTasks = days.reduce((sum, k) => sum + (tasksByDay.get(k)?.length ?? 0), 0);
  const countEvents = days.reduce((sum, k) => sum + (byDay.get(k)?.length ?? 0), 0);
  const empty = countTasks === 0 && countEvents === 0;

  return (
    <section>
      <div className="day-nav">
        <Button variant="soft" onClick={() => onOpenDay(addDaysKey(start, -7))} ariaLabel={cal.prev}>‹</Button>
        <strong className="day-label">{`${days[0].slice(5)} — ${days[6].slice(5)}`}</strong>
        <Button variant="soft" onClick={() => onOpenDay(addDaysKey(start, 7))} ariaLabel={cal.next}>›</Button>
        {start !== weekStartKey(todayKey()) && (
          <Button variant="ghost" onClick={() => onOpenDay(todayKey())}>{cal.today}</Button>
        )}
      </div>

      <p className="day-summary muted">
        {`📋 ${countTasks} ${cal.tasksWord} · 🗓️ ${countEvents} ${cal.eventsWord}`}
      </p>

      {empty ? (
        <EmptyState>{cal.emptyWeek}</EmptyState>
      ) : (
        <div className="week-grid">
          {days.map((key, i) => (
            <div key={key} className={`week-col${key === todayKey() ? ' today' : ''}`}>
              <button className="week-day-head" onClick={() => onOpenDay(key)} title={cal.openDayHint}>
                {cal.dayNames[i]}<br /><span className="muted">{key.slice(5)}</span>
              </button>
              <ul className="event-list">
                {(tasksByDay.get(key) ?? []).map((task) => (
                  <li key={task.id} className="event-chip task-chip">
                    <span className="event-time">{timeOf(task.scheduledAt)}</span>
                    {task.title}
                  </li>
                ))}
                {(byDay.get(key) ?? []).map((occ) => (
                  <li
                    key={`${occ.event.id}-${occ.start}`}
                    className={`event-chip ${KIND_CLASS[occ.event.kind]}${occ.event.source === 'google' ? ' ev-google' : ''}`}
                  >
                    <span className="event-time">
                      {occ.event.allDay ? cal.allDayLabel : formatEventTime(occ.start, occ.end)}
                    </span>
                    {occ.event.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
/** عرض الشهر: شبكة 6×7 — كل يوم بعدّاد مهامه وأحداثه، والضغط يفتحه */
function MonthView({ anchorKey, onOpenDay }: { anchorKey: string; onOpenDay: (key: string) => void }) {
  const events = usePlanningStore((s) => s.events);
  const googleEvents = usePlanningStore((s) => s.googleEvents);
  const tasks = usePlanningStore((s) => s.tasks);

  const keys = useMemo(() => monthGridKeys(anchorKey), [anchorKey]);
  const allEvents = useMemo(() => mergeEventSources(ownLocalEvents(events), googleEvents), [events, googleEvents]);
  const byDay = useMemo(() => eventsForMonth(allEvents, anchorKey), [allEvents, anchorKey]);
  const tasksByDay = useMemo(() => groupTasksByDay(tasks), [tasks]);

  const month = monthOfKey(anchorKey);
  const year = anchorKey.slice(0, 4);
  const countTasks = keys.reduce((sum, k) => sum + (tasksByDay.get(k)?.length ?? 0), 0);
  const countEvents = keys.reduce((sum, k) => sum + (byDay.get(k)?.length ?? 0), 0);
  const empty = countTasks === 0 && countEvents === 0;

  const shiftMonth = (delta: number) => {
    const d = new Date(`${anchorKey}T00:00:00`);
    d.setDate(1);
    d.setMonth(d.getMonth() + delta);
    onOpenDay(dateKey(d));
  };

  return (
    <section>
      <div className="day-nav">
        <Button variant="soft" onClick={() => shiftMonth(-1)} ariaLabel={cal.prev}>‹</Button>
        <strong className="day-label">{`${cal.monthNames[month]} ${year}`}</strong>
        <Button variant="soft" onClick={() => shiftMonth(1)} ariaLabel={cal.next}>›</Button>
        {month !== monthOfKey(todayKey()) && (
          <Button variant="ghost" onClick={() => onOpenDay(todayKey())}>{cal.today}</Button>
        )}
      </div>

      <p className="day-summary muted">
        {`📋 ${countTasks} ${cal.tasksWord} · 🗓️ ${countEvents} ${cal.eventsWord} · ${cal.openDayHint}`}
      </p>

      <div className="month-head" aria-hidden="true">
        {cal.daysShort.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>

      <div className="month-grid">
        {keys.map((key) => {
          const taskCount = tasksByDay.get(key)?.length ?? 0;
          const eventCount = byDay.get(key)?.length ?? 0;
          const outside = monthOfKey(key) !== month;
          const classes = [
            'month-cell',
            outside ? 'outside' : '',
            key === todayKey() ? 'today' : ''
          ].filter(Boolean).join(' ');
          return (
            <button
              key={key}
              className={classes}
              aria-label={`${key} — ${taskCount} ${cal.tasksWord} · ${eventCount} ${cal.eventsWord}`}
              onClick={() => onOpenDay(key)}
            >
              <span className="month-day-num">{Number(key.slice(8, 10))}</span>
              <span className="month-badges">
                {taskCount > 0 && <span className="mb mb-task">📋 {taskCount}</span>}
                {eventCount > 0 && <span className="mb mb-event">🗓️ {eventCount}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {empty && <p className="muted month-empty">{cal.emptyMonth}</p>}
    </section>
  );
}

/** حاوية التقويم — مُدارة من الصفحة: العرض واليوم المرجعي */
export function CalendarView({
  view,
  anchorKey,
  onOpenDay
}: {
  view: CalendarViewMode;
  anchorKey: string;
  onOpenDay: (key: string) => void;
}) {
  if (view === 'day') return <DayView dayKeyStr={anchorKey} onOpenDay={onOpenDay} />;
  if (view === 'week') return <WeekView anchorKey={anchorKey} onOpenDay={onOpenDay} />;
  return <MonthView anchorKey={anchorKey} onOpenDay={onOpenDay} />;
}
