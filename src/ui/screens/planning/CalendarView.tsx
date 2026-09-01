// ============================================================
// رِفق — عرض التقويم (يوم/أسبوع) — عرض فقط، المنطق في الـstore والمحركات
// الأسبوع يبدأ السبت (أسبوع عربي)، والثوابت تظهر بلون صريح.
// ============================================================

import { useMemo, useState } from 'react';
import { usePlanningStore, todayKey } from '../../../core/store/usePlanningStore';
import {
  eventsForDay,
  eventsForWeek,
  weekDayKeys,
  addDaysKey,
  formatEventTime
} from '../../../core/engines/calendarEngine';
import type { CalendarEventKind } from '../../../core/types';
import { voice } from '../../../i18n/voice';
import { Button, Card, EmptyState } from '../../components';

const cal = voice.planning.calendar;
const KIND_CLASS: Record<CalendarEventKind, string> = { fixed: 'ev-fixed', flexible: 'ev-flexible' };

interface OccLike {
  event: { id: string; title: string; kind: CalendarEventKind };
  start: string;
  end: string;
}

function EventRow({ occ, onDelete }: { occ: OccLike; onDelete?: (id: string) => void }) {
  return (
    <li className={`event-row ${KIND_CLASS[occ.event.kind]}`}>
      <span className="event-time">{formatEventTime(occ.start, occ.end)}</span>
      <span className="event-title">{occ.event.title}</span>
      <span className="event-kind">{cal.kindLabels[occ.event.kind]}</span>
      {onDelete && (
        <button className="task-delete" aria-label={voice.common.delete} onClick={() => onDelete(occ.event.id)}>
          ×
        </button>
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
      <input className="text-input" placeholder={cal.note} aria-label={cal.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <Button onClick={() => void submit()}>{cal.save}</Button>
    </div>
  );
}

function DayView() {
  const events = usePlanningStore((s) => s.events);
  const deleteEvent = usePlanningStore((s) => s.deleteEvent);
  const [offset, setOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const dayKeyStr = addDaysKey(todayKey(), offset);

  const dayEvents = useMemo(() => eventsForDay(events, dayKeyStr), [events, dayKeyStr]);
  const d = new Date(`${dayKeyStr}T00:00:00`);
  const label = `${cal.dayNames[(d.getDay() + 1) % 7]} ${dayKeyStr}`;

  return (
    <section>
      <div className="day-nav">
        <Button variant="soft" onClick={() => setOffset(offset - 1)} ariaLabel={cal.prev}>‹</Button>
        <strong className="day-label">{label}</strong>
        <Button variant="soft" onClick={() => setOffset(offset + 1)} ariaLabel={cal.next}>›</Button>
        {offset !== 0 && <Button variant="ghost" onClick={() => setOffset(0)}>{cal.today}</Button>}
      </div>

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
    </section>
  );
}

function WeekView({ onOpenDay }: { onOpenDay: () => void }) {
  const events = usePlanningStore((s) => s.events);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = addDaysKey(todayKey(), weekOffset * 7 - ((new Date().getDay() + 1) % 7));
  const byDay = useMemo(() => eventsForWeek(events, weekStart), [events, weekStart]);
  const anyEvent = [...byDay.values()].some((list) => list.length > 0);

  return (
    <section>
      <div className="day-nav">
        <Button variant="soft" onClick={() => setWeekOffset(weekOffset - 1)} ariaLabel={cal.prev}>‹</Button>
        <strong className="day-label">{weekStart}</strong>
        <Button variant="soft" onClick={() => setWeekOffset(weekOffset + 1)} ariaLabel={cal.next}>›</Button>
        {weekOffset !== 0 && <Button variant="ghost" onClick={() => setWeekOffset(0)}>{cal.today}</Button>}
      </div>

      {!anyEvent ? (
        <EmptyState>{cal.emptyWeek}</EmptyState>
      ) : (
        <div className="week-grid">
          {weekDayKeys(weekStart).map((key, i) => (
            <div key={key} className={`week-col${key === todayKey() ? ' today' : ''}`}>
              <button className="week-day-head" onClick={onOpenDay}>
                {cal.dayNames[i]}<br /><span className="muted">{key.slice(5)}</span>
              </button>
              <ul className="event-list">
                {(byDay.get(key) ?? []).map((occ) => (
                  <li key={`${occ.event.id}-${occ.start}`} className={`event-chip ${KIND_CLASS[occ.event.kind]}`}>
                    <span className="event-time">{formatEventTime(occ.start, occ.end)}</span>
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

export function CalendarView({ initialView }: { initialView: 'day' | 'week' }) {
  const [view, setView] = useState<'day' | 'week'>(initialView);
  return view === 'day' ? <DayView /> : <WeekView onOpenDay={() => setView('day')} />;
}