// ============================================================
// رِفق — Screen: اليوم (Today)
// قلب رِفق اليومي: ترحيب، طاقة، أولويات، اقتراح واحد، التقاط سريع.
// بلا guilt، بلا أرقام على القلب، والراحة جزء من الخطة.
// المنطق كله في الـstores والمحركات — هنا عرض فقط.
// ============================================================

import { useEffect, useState } from 'react';
import { useTodayStore } from '../../../core/store/useTodayStore';
import { describeReason } from '../../../core/engines/priorityEngine';
import { voice, greetingForHour } from '../../../i18n/voice';
import { Card, Button, Chip, EmptyState } from '../../components';

const TIME_CHOICES = [15, 30, 45, 60];

export function TodayPage() {
  const tasks = useTodayStore((s) => s.tasks);
  const todayEnergy = useTodayStore((s) => s.todayEnergy);
  const lightDay = useTodayStore((s) => s.lightDay);
  const topPriorities = useTodayStore((s) => s.topPriorities);
  const suggestion = useTodayStore((s) => s.suggestion);
  const loadToday = useTodayStore((s) => s.loadToday);
  const checkIn = useTodayStore((s) => s.checkIn);
  const askSuggestion = useTodayStore((s) => s.askSuggestion);
  const addQuickTask = useTodayStore((s) => s.addQuickTask);
  const completeTask = useTodayStore((s) => s.completeTask);
  const deleteTask = useTodayStore((s) => s.deleteTask);
  const updateTask = useTodayStore((s) => s.updateTask);
  const clearSuggestion = useTodayStore((s) => s.clearSuggestion);

  const [quick, setQuick] = useState('');
  const [energyNote, setEnergyNote] = useState('');
  const [asked, setAsked] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const submitQuick = async () => {
    const value = quick.trim();
    if (!value) return;
    await addQuickTask(value);
    setQuick('');
  };

  const chooseTime = async (minutes: number) => {
    setAsked(true);
    await askSuggestion(minutes);
  };

  const startSuggested = () => {
    if (!suggestion?.task) return;
    const id = suggestion.task.id;
    void updateTask(id, { status: 'in_progress' });
    clearSuggestion();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const value = editValue.trim();
    if (value) await updateTask(editingId, { title: value });
    setEditingId(null);
  };

  return (
    <section className="screen">
      <header className="today-greeting">
        <h2>{greetingForHour(new Date().getHours())}</h2>
        <p className="muted">{voice.today.hint}</p>
      </header>

      {/* طاقة اليوم */}
      <Card title={voice.today.energy.title} icon="🌿">
        <p className="muted">{voice.today.energy.question}</p>
        <div className="energy-row">
          {(['low', 'medium', 'high'] as const).map((level) => (
            <button
              key={level}
              className={`energy-btn${todayEnergy === level ? ' selected' : ''}`}
              onClick={() => void checkIn(level, energyNote, lightDay)}
            >
              {voice.today.energy[level]}
            </button>
          ))}
        </div>
        <label className="light-day">
          <input
            type="checkbox"
            checked={lightDay}
            disabled={!todayEnergy}
            title={todayEnergy ? undefined : voice.today.energy.needLevelFirst}
            onChange={(e) => {
              const next = e.target.checked;
              if (todayEnergy) void checkIn(todayEnergy, energyNote, next);
            }}
          />
          {voice.today.energy.lightDay}
        </label>
        <input
          className="text-input"
          value={energyNote}
          placeholder={voice.today.energy.notePlaceholder}
          aria-label={voice.today.energy.notePlaceholder}
          onChange={(e) => setEnergyNote(e.target.value)}
          onBlur={() => {
            if (todayEnergy) void checkIn(todayEnergy, energyNote, lightDay);
          }}
        />
        {todayEnergy && <p className="saved-hint">{voice.today.energy.saved}</p>}
      </Card>

      {/* ✨ ماذا أفعل الآن؟ */}
      <Card title={voice.today.suggestion.title}>
        {!suggestion && (
          <>
            <p className="muted">{voice.today.suggestion.question}</p>
            <div className="time-row">
              {TIME_CHOICES.map((m) => (
                <Button key={m} variant="soft" onClick={() => void chooseTime(m)}>
                  {m} {voice.today.suggestion.minutes}
                </Button>
              ))}
            </div>
            {asked && <p className="muted">…</p>}
          </>
        )}
        {suggestion?.task && (
          <div className="suggestion-result">
            <p className="suggestion-title">📌 {suggestion.task.title}</p>
            <p className="muted">
              ⏱ {suggestion.task.estimatedDuration} {voice.today.suggestion.minutes}
            </p>
            <div className="reason-chips">
              <Chip>{suggestion.reason}</Chip>
            </div>
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <Button onClick={startSuggested}>{voice.today.suggestion.start}</Button>
              <Button variant="ghost" onClick={clearSuggestion}>
                {voice.today.suggestion.again}
              </Button>
            </div>
          </div>
        )}
        {suggestion && !suggestion.task && (
          <div>
            <p>{suggestion.reason}</p>
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <Button variant="ghost" onClick={clearSuggestion}>
                {voice.today.suggestion.again}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* أهم أولويات اليوم */}
      <Card title={voice.today.priorities.title} icon="🎯">
        {topPriorities.length === 0 ? (
          <EmptyState>{voice.today.priorities.empty}</EmptyState>
        ) : (
          <ol className="priority-list">
            {topPriorities.map((task, index) => (
              <li key={task.id} className="priority-row">
                <span className="priority-index">{index + 1}</span>
                <div>
                  <span className="task-title">{task.title}</span>
                  <div className="reason-chips">
                    <Chip>{describeReason(task)}</Chip>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* التقاط سريع */}
      <Card title={voice.today.quickCapture.title} icon="🪶">
        <input
          className="text-input"
          value={quick}
          placeholder={voice.today.quickCapture.placeholder}
          aria-label={voice.today.quickCapture.placeholder}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submitQuick();
          }}
        />
      </Card>

      {/* مهامي الحالية */}
      <Card title={voice.today.tasks.title} icon="📋">
        {tasks.length === 0 ? (
          <EmptyState>{voice.today.tasks.empty}</EmptyState>
        ) : (
          <ul className="task-list">
            {tasks.map((task) => (
              <li key={task.id} className={`task-row${task.status === 'in_progress' ? ' in-progress' : ''}`}>
                <button
                  className="task-check"
                  aria-label={voice.common.complete}
                  onClick={() => void completeTask(task.id)}
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
                    onBlur={() => void saveEdit()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveEdit();
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
                {task.status === 'in_progress' && <Chip>{voice.today.suggestion.inProgressBadge}</Chip>}
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
    </section>
  );
}