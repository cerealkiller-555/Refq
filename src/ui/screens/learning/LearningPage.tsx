// ============================================================
// رِفق — Screen: رحلتي (Learning)
// المسارات، العناصر، الخطوة القادمة، الجلسات.
// نبرة هادئة بلا ضغط — خطوة واحدة تكفي للبداية.
// كل المنطق في الـstore والمحركات — هنا عرض فقط.
// ============================================================

import { useEffect, useState } from 'react';
import { useLearningStore } from '../../../core/store/useLearningStore';
import { pathProgress } from '../../../core/engines/learningEngine';
import { voice } from '../../../i18n/voice';
import { Card, Button, Chip, EmptyState } from '../../components';
import type { LearningPath, LearningPathType, PathItem, Session } from '../../../core/types';

const L = voice.learning;
const PATH_TYPES: LearningPathType[] = [
  'university',
  'course',
  'sharia_course',
  'book',
  'quran'
];

interface ItemFormProps {
  pathId: string;
  nextOrder: number;
  onDone: () => void;
}

function ItemForm({ pathId, nextOrder, onDone }: ItemFormProps) {
  const addItem = useLearningStore((s) => s.addItem);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    await addItem({
      pathId,
      title: value,
      order: nextOrder,
      status: 'todo',
      estimatedDuration: duration
    } as Omit<PathItem, 'id' | 'createdAt' | 'updatedAt'>);
    setTitle('');
    setDuration(30);
    onDone();
  };

  return (
    <div className="add-form">
      <div className="form-row">
        <input
          className="text-input"
          placeholder={L.addItemPlaceholder}
          aria-label={L.addItemPlaceholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        <div className="form-field" style={{ minWidth: 90, maxWidth: 140 }}>
          <input
            className="text-input"
            type="number"
            min={5}
            step={5}
            value={duration}
            aria-label={voice.today.suggestion.minutes}
            onChange={(e) => setDuration(Math.max(5, parseInt(e.target.value, 10) || 5))}
          />
        </div>
        <Button variant="soft" onClick={() => void submit()}>
          {L.addItem}
        </Button>
      </div>
    </div>
  );
}

function PathCard({ path }: { path: LearningPath }) {
  const items = useLearningStore((s) => s.itemsByPath[path.id] ?? []);
  const getItemsForPath = useLearningStore((s) => s.getItemsForPath);
  const updateItem = useLearningStore((s) => s.updateItem);
  const deleteItem = useLearningStore((s) => s.deleteItem);
  const setPathStatus = useLearningStore((s) => s.setPathStatus);
  const deletePath = useLearningStore((s) => s.deletePath);
  const load = useLearningStore((s) => s.load);
  const addSession = useLearningStore((s) => s.addSession);
  const sessions = useLearningStore((s) => s.sessions);

  const [showItemForm, setShowItemForm] = useState(false);
  const [sessionFor, setSessionFor] = useState<PathItem | null>(null);

  useEffect(() => {
    void getItemsForPath(path.id);
  }, [getItemsForPath, path.id]);

  const next = items.filter((i) => i.status !== 'done').sort((a, b) => a.order - b.order)[0];
  const progress = pathProgress(items);
  const nextOrder = items.length ? Math.max(...items.map((i) => i.order)) + 1 : 1;
  const itemSessions = (itemId: string) =>
    sessions.filter((s) => s.pathItemId === itemId).length;

  const logSession = async (item: PathItem) => {
    await addSession({
      pathItemId: item.id,
      date: new Date().toISOString(),
      durationMinutes: item.estimatedDuration || 30
    } as Omit<Session, 'id' | 'createdAt' | 'updatedAt'>);
    setSessionFor(null);
    await load();
  };

  return (
    <Card title={path.title} icon={L.types[path.type] ?? '🎓'}>
      {/* الخطوة القادمة */}
      {next ? (
        <div className="next-step">
          <p className="muted">{L.nextStepHint}</p>
          <div className="next-step-item">
            <span className="task-title">{next.title}</span>
            {next.estimatedDuration ? (
              <Chip>
                {next.estimatedDuration} {voice.today.suggestion.minutes}
              </Chip>
            ) : null}
            <Button variant="ghost" onClick={() => setSessionFor(next)}>
              ⏱ {L.sessions}
            </Button>
          </div>
          <p className="muted">
            {L.progressLabel.replace('{done}', String(progress.done)).replace('{total}', String(progress.total))}
          </p>
        </div>
      ) : (
        <EmptyState>{L.noNext}</EmptyState>
      )}

      {/* طلب تسجيل جلسة */}
      {sessionFor && (
        <div className="session-prompt">
          <p>
            {L.sessionOf} «{sessionFor.title}»؟
          </p>
          <div className="banner-actions">
            <Button onClick={() => void logSession(sessionFor)}>{L.addSession}</Button>
            <Button variant="ghost" onClick={() => setSessionFor(null)}>{voice.common.cancel}</Button>
          </div>
        </div>
      )}

      {/* عناصر المسار */}
      <div className="learning-items">
        <p className="section-divider">{L.itemsTitle}</p>
        {items.length === 0 ? (
          <EmptyState>{L.emptyItems}</EmptyState>
        ) : (
          <ul className="task-list">
            {items.map((item) => (
              <li
                key={item.id}
                className={`task-row${item.status === 'in_progress' ? ' in-progress' : ''}${item.status === 'done' ? ' done-row' : ''}`}
              >
                <button
                  className="task-check"
                  aria-label={voice.common.complete}
                  onClick={() => void updateItem(item.id, { status: item.status === 'done' ? 'todo' : 'done' })}
                >
                  {item.status === 'done' ? '✓' : ''}
                </button>
                <span className="task-title">{item.title}</span>
                <span className="event-kind">
                  {item.estimatedDuration ? `${item.estimatedDuration} ${voice.today.suggestion.minutes}` : ''}
                  {itemSessions(item.id) > 0 ? ` · ${itemSessions(item.id)} ${L.sessions}` : ''}
                </span>
                <button className="task-delete" aria-label={voice.common.delete} onClick={() => void deleteItem(item.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {showItemForm ? (
          <ItemForm pathId={path.id} nextOrder={nextOrder} onDone={() => setShowItemForm(false)} />
        ) : (
          <Button variant="soft" onClick={() => setShowItemForm(true)}>+ {L.addItemPlaceholder}</Button>
        )}
      </div>

      {/* تحكم المسار */}
      <div className="banner-actions" style={{ marginTop: 'var(--space-3)' }}>
        <Button variant="ghost" onClick={() => void setPathStatus(path.id, path.status === 'active' ? 'paused' : 'active')}>
          {path.status === 'active' ? L.pause : L.activate}
        </Button>
        <Button variant="danger" onClick={() => void deletePath(path.id)}>
          {voice.common.delete}
        </Button>
      </div>
    </Card>
  );
}

export function LearningPage() {
  const paths = useLearningStore((s) => s.paths);
  const load = useLearningStore((s) => s.load);
  const addPath = useLearningStore((s) => s.addPath);

  const [name, setName] = useState('');
  const [type, setType] = useState<LearningPathType>('university');

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const value = name.trim();
    if (!value) return;
    await addPath({
      title: value,
      type,
      status: 'active',
      order: paths.length + 1
    } as Omit<LearningPath, 'id' | 'createdAt' | 'updatedAt'>);
    setName('');
  };

  return (
    <section className="screen">
      <h2 className="screen-title">{L.title}</h2>

      {/* مسار جديد */}
      <Card title={L.addPathTitle} icon="➕">
        <div className="add-form">
          <input
            className="text-input"
            placeholder={L.pathName}
            aria-label={L.pathName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
          <div className="form-row">
            <div className="form-field">
              <label>{L.pathType}</label>
              <select
                className="text-input"
                value={type}
                onChange={(e) => setType(e.target.value as LearningPathType)}
              >
                {PATH_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {L.types[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ alignSelf: 'flex-end' }}>
              <Button onClick={() => void submit()}>{L.addPath}</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* المسارات */}
      {paths.length === 0 ? (
        <Card>
          <EmptyState>{L.empty}</EmptyState>
        </Card>
      ) : (
        paths.map((p) => <PathCard key={p.id} path={p} />)
      )}
    </section>
  );
}