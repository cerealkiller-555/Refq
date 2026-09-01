// ============================================================
// رِفق — Screen: التخطيط (Planning)
// P1: إدارة المهام كاملة (إضافة/تعديل/حذف/إنجاز/إعادة فتح).
// التقويم نفسه يُبنى في P2 فوق هذا القسم.
// ============================================================

import { useEffect, useState } from 'react';
import { usePlanningStore } from '../../../core/store/usePlanningStore';
import { rankTasks, describeReason } from '../../../core/engines/priorityEngine';
import { voice } from '../../../i18n/voice';
import { Card, Button, Chip, EmptyState } from '../../components';
import type { TaskRecord, EnergyLevel } from '../../../core/types';

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

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    void load();
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
    <section className="screen">
      <h2 className="screen-title">📅 {voice.planning.tasksTitle}</h2>

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
                </div>
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
    </section>
  );
}