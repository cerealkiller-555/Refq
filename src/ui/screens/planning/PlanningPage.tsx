// ============================================================
// رِفق — Screen: التخطيط (Planning)
// P1: إدارة المهام كاملة (إضافة/تعديل/حذف/إنجاز/إعادة فتح).
// التقويم نفسه يُبنى في P2 فوق هذا القسم.
// ============================================================

import { useEffect, useState } from 'react';
import { usePlanningStore, todayKey } from '../../../core/store/usePlanningStore';
import { rankTasks, describeReason } from '../../../core/engines/priorityEngine';
import { findOverdueScheduledTasks } from '../../../core/engines/recoveryEngine';
import { voice } from '../../../i18n/voice';
import { Card, Button, Chip, EmptyState } from '../../components';
import { CalendarView } from './CalendarView';
import type { TaskRecord, EnergyLevel } from '../../../core/types';

const cal = voice.planning.calendar;

type Tab = 'tasks' | 'day' | 'week';

const EMPTY_FORM = {
  title: '',
  importance: 'low' as TaskRecord['importance'],
  urgency: 'low' as TaskRecord['urgency'],
  duration: 30,
  deadline: '',
  energy: '' as EnergyLevel | ''
};

export function PlanningPage() {
  const tasks = usePlanningStore((s) => s.tasks);
  const load = usePlanningStore((s) => s.load);
  const addTask = usePlanningStore((s) => s.addTask);
  const updateTask = usePlanningStore((s) => s.updateTask);
  const deleteTask = usePlanningStore((s) => s.deleteTask);
  const markTaskDone = usePlanningStore((s) => s.markTaskDone);
  const reopenTask = usePlanningStore((s) => s.reopenTask);
  const scheduleTask = usePlanningStore((s) => s.scheduleTask);
  const replan = usePlanningStore((s) => s.replan);
  const replanResult = usePlanningStore((s) => s.replanResult);
  const clearReplanResult = usePlanningStore((s) => s.clearReplanResult);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [tab, setTab] = useState<Tab>('tasks');
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [schedDate, setSchedDate] = useState(todayKey());
  const [schedTime, setSchedTime] = useState('10:00');

  useEffect(() => {
    void load();
  }, [load]);

  const open = rankTasks(tasks).map((entry) => entry.task);
  const done = tasks.filter((t) => t.status === 'done');
  const overdue = findOverdueScheduledTasks(tasks, todayKey());

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

  return (
    <section className="screen">
      <h2 className="screen-title">📅 {voice.planning.tasksTitle}</h2>

      {/* لافتة يوم فائت — تظهر فقط للمهام المتأخرة، وبلا أي إجراء تلقائي */}
      {overdue.length > 0 && !replanResult && (
        <div className="recovery-banner" role="status">
          <p>{cal.recovery.banner}</p>
          <div className="banner-actions">
            <Button onClick={() => void replan()}>{cal.recovery.button}</Button>
          </div>
        </div>
      )}
      {replanResult && (
        <div className="recovery-banner applied" role="status">
          <p>{cal.recovery.applied}</p>
          <p className="muted">
            {replanResult.moved.length > 0
              ? replanResult.moved.map((m) => `${m.taskId.slice(0, 4)}… ← ${m.scheduledAt.slice(0, 10)}`).join(' · ')
              : '—'}
          </p>
          <Button variant="ghost" onClick={clearReplanResult}>{cal.recovery.dismiss}</Button>
        </div>
      )}

      {/* التبويبات */}
      <div className="tabs" role="tablist">
        {(['tasks', 'day', 'week'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {cal.tabs[t]}
          </button>
        ))}
      </div>

      {tab === 'tasks' ? (
        <>
      {/* مهمة جديدة */}
      <Card title={voice.planning.addTitle} icon="➕">
        <div className="add-form">
          <input
            className="text-input"
            placeholder={voice.planning.fields.title}
            aria-label={voice.planning.fields.title}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
          <div className="form-row">
            <div className="form-field">
              <label>{voice.planning.fields.importance}</label>
              <select
                className="text-input"
                value={form.importance}
                onChange={(e) => setForm({ ...form, importance: e.target.value as TaskRecord['importance'] })}
              >
                <option value="low">{voice.planning.importanceLabels.low}</option>
                <option value="high">{voice.planning.importanceLabels.high}</option>
              </select>
            </div>
            <div className="form-field">
              <label>{voice.planning.fields.urgency}</label>
              <select
                className="text-input"
                value={form.urgency}
                onChange={(e) => setForm({ ...form, urgency: e.target.value as TaskRecord['urgency'] })}
              >
                <option value="low">{voice.planning.urgencyLabels.low}</option>
                <option value="high">{voice.planning.urgencyLabels.high}</option>
              </select>
            </div>
            <div className="form-field">
              <label>{voice.planning.fields.duration}</label>
              <input
                className="text-input"
                type="number"
                min={5}
                step={5}
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) || 30 })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>{voice.planning.fields.deadline}</label>
              <input
                className="text-input"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>{voice.planning.fields.energy}</label>
              <select
                className="text-input"
                value={form.energy}
                                onChange={(e) => setForm({ ...form, energy: e.target.value as EnergyLevel | '' })}
              >
                <option value="">—</option>
                <option value="low">{voice.planning.energyLabels.low}</option>
                <option value="medium">{voice.planning.energyLabels.medium}</option>
                <option value="high">{voice.planning.energyLabels.high}</option>
              </select>
            </div>
          </div>
          <div>
            <Button onClick={() => void submit()} disabled={!form.title.trim()}>
              {voice.planning.fields.save}
            </Button>
          </div>
        </div>
      </Card>

      {/* المهام المفتوحة */}
      <Card title={`${voice.planning.tasksTitle} (${open.length})`}>
        {open.length === 0 ? (
          <EmptyState>{voice.planning.empty}</EmptyState>
        ) : (
          <ul className="task-list">
            {open.map((task) => (
              <li key={task.id} className={`task-row${task.status === 'in_progress' ? ' in-progress' : ''}`}>
                <button
                  className="task-check"
                  aria-label={voice.common.complete}
                  onClick={() => void markTaskDone(task.id)}
                >
                  ✓
                </button>
                {editingId === task.id ? (
                  <input
                    className="text-input"
                    value={editValue}
                    autoFocus
                    aria-label={voice.common.edit}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => void saveEdit(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveEdit(task.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <span
                    className="task-title"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setEditingId(task.id);
                      setEditValue(task.title);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingId(task.id);
                        setEditValue(task.title);
                      }
                    }}
                  >
                    {task.title}
                  </span>
                )}
                <div className="reason-chips">
                  <Chip>{describeReason(task)}</Chip>
                  {task.scheduledAt && <Chip>{cal.scheduledChip}</Chip>}
                </div>
                {scheduling === task.id ? (
                  <div className="schedule-form">
                    <input
                      type="date"
                      className="text-input"
                      aria-label={cal.schedule.date}
                      value={schedDate}
                      onChange={(e) => setSchedDate(e.target.value)}
                    />
                    <input
                      type="time"
                      className="text-input"
                      aria-label={cal.schedule.time}
                      value={schedTime}
                      onChange={(e) => setSchedTime(e.target.value)}
                    />
                    <Button
                      onClick={() => {
                        void scheduleTask(task.id, schedDate, schedTime);
                        setScheduling(null);
                      }}
                    >
                      {cal.schedule.confirm}
                    </Button>
                    <Button variant="ghost" onClick={() => setScheduling(null)}>{cal.schedule.cancel}</Button>
                  </div>
                ) : (
                  <button
                    className="task-schedule"
                    aria-label={cal.schedule.button}
                    title={cal.schedule.button}
                    onClick={() => {
                      setScheduling(task.id);
                      setSchedDate(task.scheduledAt?.slice(0, 10) ?? todayKey());
                      setSchedTime(
                        task.scheduledAt
                          ? new Date(task.scheduledAt).toTimeString().slice(0, 5)
                          : '10:00'
                      );
                    }}
                  >
                    📅
                  </button>
                )}
                <button
                  className="task-delete"
                  aria-label={voice.common.delete}
                  onClick={() => void deleteTask(task.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* أُنجزت */}
      {done.length > 0 && (
        <>
          <p className="section-divider">
            {voice.planning.doneTitle} ({done.length})
          </p>
          <Card>
            <ul className="task-list">
              {done.map((task) => (
                <li key={task.id} className="task-row done-row">
                  <button
                    className="task-check"
                    aria-label={voice.common.reopen}
                    onClick={() => void reopenTask(task.id)}
                  >
                    ↺
                  </button>
                  <span className="task-title">{task.title}</span>
                  <button
                    className="task-delete"
                    aria-label={voice.common.delete}
                    onClick={() => void deleteTask(task.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
        </>
      ) : (
        <CalendarView initialView={tab === 'day' ? 'day' : 'week'} />
      )}
    </section>
  );
}