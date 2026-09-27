// ============================================================
// رِفق — المهام المباشرة داخل «خطتي» الموحّدة — تصديران:
//  • TasksGlance: لمحة سريعة + لافتة «يوم فائت» + لافتة إعادة التوزيع
//    (تُعرض أعلى الصفحة قبل بطاقات المواد).
//  • TasksPanel: مهمة جديدة (سطر واحد + تفاصيل مخفية)، القائمة المفتوحة،
//    و«أُنجزت» المطوية (يُعرض أسفل بطاقات المواد).
// التقويم (يوم/أسبوع/شهر) بقي مستقلًا في PlanningPage.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { usePlanningStore, todayKey } from '../../../core/store/usePlanningStore';
import { rankTasks, describeReason } from '../../../core/engines/priorityEngine';
import { findOverdueScheduledTasks } from '../../../core/engines/recoveryEngine';
import {
  eventsForWeek,
  dateKey,
  weekDayKeys,
  weekStartKey
} from '../../../core/engines/calendarEngine';
import { voice } from '../../../i18n/voice';
import { Card, Button, Chip, EmptyState } from '../../components';
import type { TaskRecord, EnergyLevel } from '../../../core/types';

const cal = voice.planning.calendar;
const glance = voice.planning.glance;
const M = voice.myPlan;

const EMPTY_FORM = {
  title: '',
  importance: 'low' as TaskRecord['importance'],
  urgency: 'low' as TaskRecord['urgency'],
  duration: 30,
  deadline: '',
  energy: '' as EnergyLevel | ''
};

/** لمحة المهام ولافتات التعافي — قراءة فقط، وبلا أي إجراء تلقائي */
export function TasksGlance() {
  const tasks = usePlanningStore((s) => s.tasks);
  const events = usePlanningStore((s) => s.events);
  const load = usePlanningStore((s) => s.load);
  const replan = usePlanningStore((s) => s.replan);
  const replanResult = usePlanningStore((s) => s.replanResult);
  const clearReplanResult = usePlanningStore((s) => s.clearReplanResult);

  useEffect(() => {
    // قاعدة مغلقة/خطأ ← نكمل بلا انهيار (نفس عُرف تبويب اليوم)
    void load().catch(() => {});
  }, [load]);

  const open = rankTasks(tasks).map((entry) => entry.task);
  const overdue = findOverdueScheduledTasks(tasks, todayKey());

  // ===== لمحة سريعة: أرقام تعطي اتجاهًا فوريًا بلا توهان =====
  const weekStart = useMemo(() => weekStartKey(todayKey()), []);
  const weekDaySet = useMemo(() => new Set(weekDayKeys(weekStart)), [weekStart]);
  const weekTasks = useMemo(
    () => tasks.filter(
      (t) => t.scheduledAt && t.status !== 'done' && weekDaySet.has(dateKey(new Date(t.scheduledAt)))
    ).length,
    [tasks, weekDaySet]
  );
  const weekEvents = useMemo(() => {
    // الأحداث المرنة المربوطة انعكاسات مهام تُعدّ في weekTasks — لا عدّ مزدوج
    const byDay = eventsForWeek(events.filter((e) => !e.linkedTaskId), weekStart);
    const seen = new Set<string>();
    for (const list of byDay.values()) for (const occ of list) seen.add(`${occ.event.id}-${occ.start}`);
    return seen.size;
  }, [events, weekStart]);

  return (
    <>
      {/* لمحة سريعة — أرقام اتجاه واحد بلا توهان */}
      <div className="planning-glance">
        <span className="glance-chip">📋 {glance.open.replace('{n}', String(open.length))}</span>
        <span className="glance-chip">
          {`🗓️ ${glance.weekTasks.replace('{n}', String(weekTasks))} · ${glance.weekEvents.replace('{n}', String(weekEvents))}`}
        </span>
        {overdue.length > 0 && (
          <span className="glance-chip warn">{`⏳ ${glance.overdue.replace('{n}', String(overdue.length))}`}</span>
        )}
      </div>

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
              ? replanResult.moved
                  .map((m) => {
                    const title = tasks.find((t) => t.id === m.taskId)?.title ?? voice.planning.tasksTitle;
                    return `${title} ← ${m.scheduledAt.slice(0, 10)}`;
                  })
                  .join(' · ')
              : '—'}
          </p>
          <Button variant="ghost" onClick={clearReplanResult}>{cal.recovery.dismiss}</Button>
        </div>
      )}
    </>
  );
}

/** المهام المباشرة: إضافة، القائمة المفتوحة، و«أُنجزت» — بلا تبويب خاص */
export function TasksPanel() {
  const tasks = usePlanningStore((s) => s.tasks);
  const load = usePlanningStore((s) => s.load);
  const addTask = usePlanningStore((s) => s.addTask);
  const updateTask = usePlanningStore((s) => s.updateTask);
  const deleteTask = usePlanningStore((s) => s.deleteTask);
  const markTaskDone = usePlanningStore((s) => s.markTaskDone);
  const reopenTask = usePlanningStore((s) => s.reopenTask);
  const scheduleTask = usePlanningStore((s) => s.scheduleTask);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [schedDate, setSchedDate] = useState(todayKey());
  const [schedTime, setSchedTime] = useState('10:00');
  const [showDetails, setShowDetails] = useState(false);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    // قاعدة مغلقة/خطأ ← نكمل بلا انهيار (نفس عُرف تبويب اليوم)
    void load().catch(() => {});
  }, [load]);

  const open = rankTasks(tasks).map((entry) => entry.task);
  const done = tasks.filter((t) => t.status === 'done');

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
    <>
      {/* مهمة جديدة — سطر واحد، والتفاصيل مخفية عند الطلب */}
      <Card title={voice.planning.addTitle} icon="➕">
        <div className="add-form">
          <input
            className="text-input"
            placeholder={voice.planning.quickAddPlaceholder}
            aria-label={voice.planning.fields.title}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
          <button
            className="details-toggle"
            aria-expanded={showDetails}
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? `▾ ${voice.planning.hideDetails}` : `▸ ${voice.planning.showDetails}`}
          </button>
          {showDetails && (
            <>
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
            </>
          )}
          <div>
            <Button onClick={() => void submit()} disabled={!form.title.trim()}>
              {voice.planning.fields.save}
            </Button>
          </div>
        </div>
      </Card>


      {/* المهام المفتوحة */}
      <Card title={`${M.directTasksTitle} (${open.length})`}>
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

      {/* أُنجزت — مطفية افتراضيًا، تفتح عند الطلب */}
      {done.length > 0 && (
        <>
          <button
            className="done-toggle"
            aria-expanded={showDone}
            onClick={() => setShowDone(!showDone)}
          >
            {showDone ? '▾' : '▸'} {voice.planning.doneTitle} ({done.length})
          </button>
          {showDone && (
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
          )}
        </>
      )}
    </>
  );
}

