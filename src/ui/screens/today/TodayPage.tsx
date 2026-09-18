// ============================================================
// رِفق — Screen: اليوم (Today)
// قلب رِفق اليومي بترتيب عملي:
// التقاط سريع ← ماذا أفعل الآن ← أولويات قابلة للتنفيذ ← طاقة مختصرة ← مهام اليوم.
// بلا guilt، بلا أرقام على القلب، والراحة جزء من الخطة.
// المنطق كله في الـstores والمحركات — هنا عرض فقط.
// ============================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTodayStore } from '../../../core/store/useTodayStore';
import { describeReason } from '../../../core/engines/priorityEngine';
import { PRAYER_LABELS } from '../../../core/engines/dayPeriods';
import { isLearningItem } from '../../../core/engines/suggestionEngine';
import { voice, greetingForHour } from '../../../i18n/voice';
import { formatMinutesArabic, localDateKey } from '../../../utils';
import { Card, Button, Chip, EmptyState } from '../../components';
import type { CurrentPeriod } from '../../../core/engines/dayPeriods';
import type { TaskRecord } from '../../../core/types';

const TIME_CHOICES = [15, 30, 45, 60];

/** نص لطيف يعكس الفترة الحالية بين الصلوات (بلا ضغط) */
function periodLabel(p: CurrentPeriod): string {
  const { period } = p;
  const anchor = period.anchor;
  if (anchor === 'night') {
    if (period.end) {
      // ليل قبل الفجر — ينتهي بمرساة قادمة
      const next = p.nextAnchor ? PRAYER_LABELS[p.nextAnchor.prayer] : '';
      return voice.today.period.before.replace('{next}', next);
    }
    return voice.today.period.nightOpen;
  }
  const currentLabel = PRAYER_LABELS[anchor];
  const nextLabel = p.nextAnchor ? PRAYER_LABELS[p.nextAnchor.prayer] : '';
  if (nextLabel) return voice.today.period.between.replace('{current}', currentLabel).replace('{next}', nextLabel);
  return voice.today.period.after.replace('{current}', currentLabel);
}

/** المدة المتبقية حتى المرساة القادمة — بالساعات والدقائق (مثل: "ساعة و15 دقيقة") */
function remainingLabel(nextLabel: string | undefined, minutes: number | null): string | null {
  if (!nextLabel || minutes === null) return null;
  return voice.today.period.remaining
    .replace('{next}', nextLabel)
    .replace('{duration}', formatMinutesArabic(minutes));
}

/** هل المهمة دي من "مهام اليوم"؟ جارية، أو مجدولة/متأخرة، أو موعدها قرب، أو من أهم 3 */
function isTodaysTask(task: TaskRecord, today: string, priorityIds: Set<string>): boolean {
  if (task.status === 'in_progress') return true;
  if (priorityIds.has(task.id)) return true;
  if (task.scheduledAt) return task.scheduledAt.slice(0, 10) <= today;
  if (task.deadline) return task.deadline.slice(0, 10) <= today;
  return false;
}

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
  const startSuggestedItem = useTodayStore((s) => s.startSuggestedItem);
  const clearSuggestion = useTodayStore((s) => s.clearSuggestion);
  const anchors = useTodayStore((s) => s.anchors);
  const currentPeriod = useTodayStore((s) => s.currentPeriod);

  const [quick, setQuick] = useState('');
  const [energyNote, setEnergyNote] = useState('');
  const [asked, setAsked] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showEnergyForm, setShowEnergyForm] = useState(false);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  // من غير تسجيل → الكارت كامل. بعد التسجيل → سطر واحد مختصر مع زرار تعديل.
  useEffect(() => {
    setShowEnergyForm(!todayEnergy);
  }, [todayEnergy]);

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
    const item = suggestion.task;
    // خطوة تعليمية تُبدأ في مسارها — لا تُنشأ منها مهمة مكرّرة
    void startSuggestedItem(item.id, isLearningItem(item) ? 'learning' : 'task');
    clearSuggestion();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const value = editValue.trim();
    if (value) await updateTask(editingId, { title: value });
    setEditingId(null);
  };

  const today = localDateKey();
  const priorityIds = new Set(topPriorities.map((t) => t.id));
  const todays = tasks.filter((t) => isTodaysTask(t, today, priorityIds));
  const restCount = tasks.length - todays.length;

  const renderTaskRow = (task: TaskRecord) => (
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
  );

  return (
    <section className="screen">
      <header className="today-greeting">
        <h2>{greetingForHour(new Date().getHours())}</h2>
        <p className="muted">{voice.today.hint}</p>
      </header>

      {/* الفترة الحالية بين الصلوات — بلا ضغط */}
      {currentPeriod && (
        <div className="period-banner" role="status">
          <p className="period-line">{periodLabel(currentPeriod)}</p>
          {remainingLabel(
            currentPeriod.nextAnchor ? PRAYER_LABELS[currentPeriod.nextAnchor.prayer] : undefined,
            currentPeriod.period.remainingMinutes
          ) && (
            <p className="period-remaining">{remainingLabel(
              currentPeriod.nextAnchor ? PRAYER_LABELS[currentPeriod.nextAnchor.prayer] : undefined,
              currentPeriod.period.remainingMinutes
            )}</p>
          )}
        </div>
      )}

      {/* تذكير هادئ بأن مراسي اليوم من خدمة مواقيت الصلاة ولا تُحرَّك */}
      {anchors.length > 0 && <p className="period-guard">{voice.today.period.finalGuard}</p>}

      {/* التقاط سريع — أول حاجة، لحظة الخاطرة */}
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

      {/* ✨ ماذا أفعل الآن؟ */}
      <Card title={voice.today.suggestion.title}>
        {!suggestion && (
          <>
            <p className="muted">{voice.today.suggestion.question}</p>
            <div className="time-row">
              {TIME_CHOICES.map((m) => {
                const disabled =
                  currentPeriod?.period.remainingMinutes !== null &&
                  currentPeriod?.period.remainingMinutes !== undefined &&
                  m > currentPeriod.period.remainingMinutes;
                const nextLabel = currentPeriod?.nextAnchor
                  ? PRAYER_LABELS[currentPeriod.nextAnchor.prayer]
                  : undefined;
                return (
                  <Button
                    key={m}
                    variant="soft"
                    disabled={!!disabled}
                    title={disabled && nextLabel ? voice.today.period.afterNext.replace('{next}', nextLabel) : undefined}
                    onClick={() => void chooseTime(m)}
                  >
                    {m} {voice.today.suggestion.minutes}
                  </Button>
                );
              })}
            </div>
            {asked && <p className="muted">…</p>}
          </>
        )}
        {suggestion?.task && (
          <div className="suggestion-result">
            <p className="suggestion-title">
              {isLearningItem(suggestion.task) ? '🌱' : '📌'} {suggestion.task.title}
            </p>
            {suggestion.task.estimatedDuration != null && (
              <p className="muted">
                ⏱ {suggestion.task.estimatedDuration} {voice.today.suggestion.minutes}
              </p>
            )}
            <div className="reason-chips">
              {isLearningItem(suggestion.task) && suggestion.task.sourceLabel && (
                <Chip>🎓 {suggestion.task.sourceLabel}</Chip>
              )}
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

      {/* أهم أولويات اليوم — قابلة للتنفيذ من هنا مباشرة */}
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
                <div className="priority-actions">
                  <button
                    className="task-check"
                    aria-label={voice.common.complete}
                    onClick={() => void completeTask(task.id)}
                  >
                    ✓
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* طاقة اليوم — سطر واحد بعد التسجيل، والكارت كامل عند التعديل */}
      <Card title={voice.today.energy.title} icon="🌿">
        {!showEnergyForm && todayEnergy ? (
          <div className="energy-compact">
            <span className="energy-label">
              {voice.today.energy.summary.replace('{level}', voice.today.energy[todayEnergy])}
            </span>
            {lightDay && <Chip>{voice.today.energy.lightDay}</Chip>}
            <Button variant="ghost" size="sm" onClick={() => setShowEnergyForm(true)}>
              {voice.today.energy.edit}
            </Button>
          </div>
        ) : (
          <>
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
            {todayEnergy && (
              <div className="row" style={{ marginTop: 'var(--space-2)' }}>
                <Button variant="ghost" size="sm" onClick={() => setShowEnergyForm(false)}>
                  {voice.today.energy.hide}
                </Button>
              </div>
            )}
            {todayEnergy && <p className="saved-hint">{voice.today.energy.saved}</p>}
          </>
        )}
      </Card>

      {/* مهام اليوم فقط — الباقي في التخطيط */}
      <Card title={`${voice.today.tasks.title} (${todays.length})`} icon="📋">
        {todays.length === 0 ? (
          <EmptyState>{voice.today.tasks.empty}</EmptyState>
        ) : (
          <ul className="task-list">{todays.map(renderTaskRow)}</ul>
        )}
        {restCount > 0 && (
          <Link className="link-planning" to="/planning">
            {voice.today.tasks.seeAll.replace('{count}', String(restCount))}
          </Link>
        )}
      </Card>
    </section>
  );
}
