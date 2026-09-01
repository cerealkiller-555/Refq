// ============================================================
// رِفق — Screen: التخطيط (Planning)
// P2: المهام + تقويم اليوم/الأسبوع + إعادة التوزيع بلطف.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { usePlanningStore } from '../../../core/store/usePlanningStore';
import { rankTasks, describeReason } from '../../../core/engines/priorityEngine';
import { eventsForDay, eventsForWeek } from '../../../core/engines/calendarEngine';
import { voice } from '../../../i18n/voice';
import { Card, Button, Chip, EmptyState } from '../../components';
import type { TaskRecord, EnergyLevel, CalendarEvent } from '../../../core/types';

type Tab = 'tasks' | 'day' | 'week';

const EMPTY_FORM = {
  title: '',
  importance: 'low' as TaskRecord['importance'],
  urgency: 'low' as TaskRecord['urgency'],
  duration: 30,
  deadline: '',
  energy: '' as EnergyLevel | ''
};

const EMPTY_EVENT = {
  title: '',
  kind: 'flexible' as CalendarEvent['kind'],
  date: '',
  time: '09:00',
  duration: 30,
  note: ''
};

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function weekStart(date: Date): Date {
  const result = new Date(date);
  const offset = (result.getDay() + 1) % 7; // السبت بداية الأسبوع في عرض رِفق
  result.setDate(result.getDate() - offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDay(key: string): string {
  return parseDateKey(key).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function eventLocalDate(event: CalendarEvent): string {
  return dateKey(new Date(event.start));
}

export function PlanningPage() {
  const tasks = usePlanningStore((s) => s.tasks);
  const events = usePlanningStore((s) => s.events);
  const load = usePlanningStore((s) => s.load);
  const addTask = usePlanningStore((s) => s.addTask);
  const updateTask = usePlanningStore((s) => s.updateTask);
  const deleteTask = usePlanningStore((s) => s.deleteTask);
  const markTaskDone = usePlanningStore((s) => s.markTaskDone);
  const reopenTask = usePlanningStore((s) => s.reopenTask);
  const addEvent = usePlanningStore((s) => s.addEvent);
  const deleteEvent = usePlanningStore((s) => s.deleteEvent);
  const scheduleTask = usePlanningStore((s) => s.scheduleTask);
  const replan = usePlanningStore((s) => s.replan);
  const lastReplan = usePlanningStore((s) => s.lastReplan);

  const [tab, setTab] = useState<Tab>('tasks');
  const [selectedDay, setSelectedDay] = useState(dateKey(new Date()));
  const [form, setForm] = useState(EMPTY_FORM);
  const [eventForm, setEventForm] = useState({ ...EMPTY_EVENT, date: dateKey(new Date()) });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState('09:00');

  useEffect(() => { void load(); }, [load]);

  const open = rankTasks(tasks).map((entry) => entry.task);
  const done = tasks.filter((t) => t.status === 'done');
  const selectedEvents = useMemo(() => eventsForDay(events, selectedDay), [events, selectedDay]);
  const startOfWeek = weekStart(parseDateKey(selectedDay));
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek, i)), [selectedDay]);
  const weekEvents = useMemo(() => eventsForWeek(events, startOfWeek), [events, startOfWeek]);
  const overdueTasks = tasks.filter((task) => task.status !== 'done' && task.deadline && task.deadline.slice(0, 10) < dateKey(new Date()));

  const submit = async () => {
    const title = form.title.trim();
    if (!title) return;
    await addTask({
      title,
      importance: form.importance,
      urgency: form.urgency,
      estimatedDuration: form.duration,
      status: 'todo',
      deadline: form.deadline ? new Date(`${form.deadline}T12:00:00`).toISOString() : undefined,
      energyRequired: form.energy ? (form.energy as EnergyLevel) : undefined
    } as Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>);
    setForm(EMPTY_FORM);
  };

  const saveEdit = async (id: string) => {
    const value = editValue.trim();
    if (value) await updateTask(id, { title: value });
    setEditingId(null);
  };

  const submitEvent = async () => {
    const title = eventForm.title.trim();
    if (!title || !eventForm.date) return;
    const [year, month, day] = eventForm.date.split('-').map(Number);
    const [hours, minutes] = eventForm.time.split(':').map(Number);
    const start = new Date(year, month - 1, day, hours, minutes).toISOString();
    const end = new Date(new Date(start).getTime() + eventForm.duration * 60000).toISOString();
    await addEvent({
      title,
      kind: eventForm.kind,
      start,
      end,
      note: eventForm.note.trim() || undefined
    } as Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>);
    setEventForm({ ...EMPTY_EVENT, date: selectedDay });
  };

  const changeSelectedDay = (delta: number) => setSelectedDay(dateKey(addDays(parseDateKey(selectedDay), delta)));

  const quickSchedule = async (taskId: string) => {
    await scheduleTask(taskId, selectedDay, scheduleTime);
    setSchedulingTaskId(null);
  };

  return (
    <section className="screen">
      <h2 className="screen-title">📅 التخطيط</h2>

      <div className="planning-tabs" role="tablist" aria-label="أقسام التخطيط">
        {(['tasks', 'day', 'week'] as Tab[]).map((item) => (
          <button key={item} role="tab" aria-selected={tab === item} className={`planning-tab${tab === item ? ' active' : ''}`} onClick={() => setTab(item)}>
            {voice.planning.tabs[item]}
          </button>
        ))}
      </div>

      {tab === 'tasks' && (
        <>
          <Card title={voice.planning.addTitle} icon="➕">
            <div className="add-form">
              <input className="text-input" placeholder={voice.planning.fields.title} aria-label={voice.planning.fields.title} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} />
              <div className="form-row">
                <div className="form-field"><label>{voice.planning.fields.importance}</label><select className="text-input" value={form.importance} onChange={(e) => setForm({ ...form, importance: e.target.value as TaskRecord['importance'] })}><option value="low">{voice.planning.importanceLabels.low}</option><option value="high">{voice.planning.importanceLabels.high}</option></select></div>
                <div className="form-field"><label>{voice.planning.fields.urgency}</label><select className="text-input" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value as TaskRecord['urgency'] })}><option value="low">{voice.planning.urgencyLabels.low}</option><option value="high">{voice.planning.urgencyLabels.high}</option></select></div>
                <div className="form-field"><label>{voice.planning.fields.duration}</label><input className="text-input" type="number" min={5} step={5} value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) || 30 })} /></div>
              </div>
              <div className="form-row">
                <div className="form-field"><label>{voice.planning.fields.deadline}</label><input className="text-input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
                <div className="form-field"><label>{voice.planning.fields.energy}</label><select className="text-input" value={form.energy} onChange={(e) => setForm({ ...form, energy: e.target.value as EnergyLevel | '' })}><option value="">—</option><option value="low">{voice.planning.energyLabels.low}</option><option value="medium">{voice.planning.energyLabels.medium}</option><option value="high">{voice.planning.energyLabels.high}</option></select></div>
              </div>
              <Button onClick={() => void submit()} disabled={!form.title.trim()}>{voice.planning.fields.save}</Button>
            </div>
          </Card>

          {overdueTasks.length > 0 && (
            <div className="replan-banner" role="status">
              <strong>{voice.planning.calendar.missed}</strong>
              <span>{voice.planning.calendar.missedHint}</span>
              <Button onClick={() => void replan()}>{voice.planning.calendar.replan}</Button>
            </div>
          )}
          {lastReplan && <div className="saved-hint">{lastReplan.message}{lastReplan.moved.length ? ` · ${voice.planning.calendar.moved} ${lastReplan.moved.length}` : ''}</div>}

          <Card title={`${voice.planning.tasksTitle} (${open.length})`}>
            {open.length === 0 ? <EmptyState>{voice.planning.empty}</EmptyState> : (
              <ul className="task-list">
                {open.map((task) => (
                  <li key={task.id} className={`task-row${task.status === 'in_progress' ? ' in-progress' : ''}`}>
                    <button className="task-check" aria-label={voice.common.complete} onClick={() => void markTaskDone(task.id)}>✓</button>
                    {editingId === task.id ? <input className="text-input" value={editValue} autoFocus aria-label={voice.common.edit} onChange={(e) => setEditValue(e.target.value)} onBlur={() => void saveEdit(task.id)} onKeyDown={(e) => { if (e.key === 'Enter') void saveEdit(task.id); if (e.key === 'Escape') setEditingId(null); }} /> : <span className="task-title" role="button" tabIndex={0} onClick={() => { setEditingId(task.id); setEditValue(task.title); }} onKeyDown={(e) => { if (e.key === 'Enter') { setEditingId(task.id); setEditValue(task.title); } }}>{task.title}</span>}
                    <div className="reason-chips"><Chip>{describeReason(task)}</Chip></div>
                    <button className="calendar-task-button" aria-label={`${voice.planning.calendar.schedule}: ${task.title}`} onClick={() => setSchedulingTaskId(schedulingTaskId === task.id ? null : task.id)}>📅</button>
                    <button className="task-delete" aria-label={voice.common.delete} onClick={() => void deleteTask(task.id)}>×</button>
                    {schedulingTaskId === task.id && <div className="quick-schedule"><input type="time" className="text-input" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} /><Button onClick={() => void quickSchedule(task.id)}>{voice.planning.calendar.schedule}</Button></div>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {done.length > 0 && <><p className="section-divider">{voice.planning.doneTitle} ({done.length})</p><Card><ul className="task-list">{done.map((task) => <li key={task.id} className="task-row done-row"><button className="task-check" aria-label={voice.common.reopen} onClick={() => void reopenTask(task.id)}>↺</button><span className="task-title">{task.title}</span><button className="task-delete" aria-label={voice.common.delete} onClick={() => void deleteTask(task.id)}>×</button></li>)}</ul></Card></>}
        </>
      )}

      {tab === 'day' && (
        <>
          <div className="calendar-toolbar"><Button onClick={() => changeSelectedDay(-1)}>{voice.planning.calendar.previous} ←</Button><strong>{formatDay(selectedDay)}</strong><Button onClick={() => setSelectedDay(dateKey(new Date()))}>{voice.planning.calendar.today}</Button><Button onClick={() => changeSelectedDay(1)}>→ {voice.planning.calendar.next}</Button></div>
          <Card title={voice.planning.calendar.addTitle} icon="➕">
            <div className="add-form"><input className="text-input" placeholder={voice.planning.calendar.title} value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} /><div className="form-row"><div className="form-field"><label>{voice.planning.calendar.kind}</label><select className="text-input" value={eventForm.kind} onChange={(e) => setEventForm({ ...eventForm, kind: e.target.value as CalendarEvent['kind'] })}><option value="flexible">{voice.planning.calendar.flexible}</option><option value="fixed">{voice.planning.calendar.fixed}</option></select></div><div className="form-field"><label>{voice.planning.calendar.date}</label><input className="text-input" type="date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} /></div><div className="form-field"><label>{voice.planning.calendar.time}</label><input className="text-input" type="time" value={eventForm.time} onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })} /></div><div className="form-field"><label>{voice.planning.calendar.duration}</label><input className="text-input" type="number" min={5} step={5} value={eventForm.duration} onChange={(e) => setEventForm({ ...eventForm, duration: Number(e.target.value) || 30 })} /></div></div><input className="text-input" placeholder={voice.planning.calendar.note} value={eventForm.note} onChange={(e) => setEventForm({ ...eventForm, note: e.target.value })} /><Button onClick={() => void submitEvent()} disabled={!eventForm.title.trim()}>{voice.planning.calendar.add}</Button></div>
          </Card>
          <Card title={voice.planning.calendar.title}>{selectedEvents.length === 0 ? <EmptyState>{voice.planning.calendar.noEvents}</EmptyState> : <ul className="calendar-list">{selectedEvents.map((event) => <li key={event.id} className={`calendar-event ${event.kind}`}><div><strong>{event.title}</strong><div className="muted">{formatTime(event.start)} — {formatTime(event.end)} · {event.kind === 'fixed' ? voice.planning.calendar.fixed : voice.planning.calendar.flexible}</div>{event.note && <div className="muted">{event.note}</div>}</div><button className="task-delete" aria-label={voice.planning.calendar.delete} onClick={() => void deleteEvent(event.id)}>×</button></li>)}</ul>}</Card>
        </>
      )}

      {tab === 'week' && (
        <>
          <div className="calendar-toolbar"><Button onClick={() => setSelectedDay(dateKey(addDays(startOfWeek, -7)))}>← {voice.planning.calendar.previous}</Button><strong>{voice.planning.calendar.week}</strong><Button onClick={() => setSelectedDay(dateKey(addDays(startOfWeek, 7)))}>{voice.planning.calendar.next} →</Button></div>
          <div className="week-grid" aria-label="التقويم الأسبوعي">
            {weekDays.map((day) => { const key = dateKey(day); const dayEvents = weekEvents.filter((event) => eventLocalDate(event) === key); return <button key={key} className={`week-day${key === selectedDay ? ' selected' : ''}`} onClick={() => { setSelectedDay(key); setTab('day'); }}><strong>{voice.planning.calendar.dayNames[day.getDay()]}</strong><span className="week-date">{day.getDate()}/{day.getMonth() + 1}</span><div className="week-events">{dayEvents.map((event) => <span key={event.id} className={`week-event ${event.kind}`}><b>{formatTime(event.start)}</b> {event.title}</span>)}{dayEvents.length === 0 && <span className="muted">—</span>}</div></button>; })}
          </div>
        </>
      )}
    </section>
  );
}