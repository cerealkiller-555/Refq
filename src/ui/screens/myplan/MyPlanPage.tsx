// ============================================================
// رِفق — Screen: خطتي (MyPlan)
// مسارات التعلّم والمواد الدراسية: المسار الأساسي الوحيد للمهام والخطوات:
// Learning Path → PathItem → Session.
// أدوات الإدارة: مسار جديد، إضافة خطوة، إيقاف مؤقت/استئناف،
// وحذف — بلا أي ضغط، خطوة واحدة تكفي.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useLearningStore } from '../../../core/store/useLearningStore';
import { useActiveTaskStore } from '../../../core/store/useActiveTaskStore';
import { nextSteps, pathProgress } from '../../../core/engines/learningEngine';
import { dateKey, todayKey } from '../../../core/engines/calendarEngine';
import { voice } from '../../../i18n/voice';
import { Card, Button, Chip, EmptyState } from '../../components';
import type { LearningPath, LearningPathType, PathItem, Session } from '../../../core/types';

const M = voice.myPlan;
const L = voice.learning;
const PATH_TYPES: LearningPathType[] = ['university', 'course', 'religious_science', 'book', 'quran'];

/** متأخرة: موعد نهائي مضى ولم تُنجز الخطوة (مقارنة بمفتاح اليوم المحلي) */
function isItemOverdue(item: PathItem): boolean {
  return !!item.deadline && item.status !== 'done' && dateKey(new Date(item.deadline)) < todayKey();
}

/** شارة الموعد النهائي — تصير «متأخرة» بلون تحذيري إذا مضى الموعد */
function ItemDeadlineChip({ item }: { item: PathItem }) {
  if (!item.deadline) return null;
  if (isItemOverdue(item)) {
    return <span className="glance-chip warn">{`⏳ ${M.overdueChip}`}</span>;
  }
  return (
    <span className="glance-chip">{M.dueChip.replace('{date}', dateKey(new Date(item.deadline)))}</span>
  );
}

export function MyPlanPage() {
  const paths = useLearningStore((s) => s.paths);
  const itemsByPath = useLearningStore((s) => s.itemsByPath);
  const sessions = useLearningStore((s) => s.sessions);
  const load = useLearningStore((s) => s.load);

  const activeTask = useActiveTaskStore((s) => s.active);
  const startItem = useActiveTaskStore((s) => s.startItem);
  /** الإنجاز من الصف: نقطة التسجيل الموحّدة للجلسة (تعرف المؤقت الجاري) */
  const completeItem = useActiveTaskStore((s) => s.completeItem);
  const addPath = useLearningStore((s) => s.addPath);
  const setPathStatus = useLearningStore((s) => s.setPathStatus);
  const deletePath = useLearningStore((s) => s.deletePath);
  const updateItem = useLearningStore((s) => s.updateItem);
  const deleteItem = useLearningStore((s) => s.deleteItem);

  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  /** إضافة خطوة جديدة — مسار واحد مفتوح في كل مرة */
  const [itemFormFor, setItemFormFor] = useState<string | null>(null);
  /** تأكيد حذف مسار — الحذف يمس خطواته فلا يتم بضغطة واحدة */
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
  /** تحرير عنوان خطوة داخل صفها — كضغط العنوان في المهام */
  const [editingItem, setEditingItem] = useState<{ id: string; value: string } | null>(null);
  /** تأكيد حذف خطوة — نفس عُرف تأكيد حذف المسار */
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<string | null>(null);
  /** نموذج مسار جديد */
  const [showAddPath, setShowAddPath] = useState(false);
  const [pathName, setPathName] = useState('');
  const [pathType, setPathType] = useState<LearningPathType>('university');

  useEffect(() => {
    void load();
  }, [load]);

  const globalNextSteps = useMemo(() => {
    return nextSteps(paths, itemsByPath);
  }, [paths, itemsByPath]);

  const lastStopByPath = useMemo(() => {
    const map = new Map<string, { itemTitle: string; date: string } | null>();
    const sessionMap = new Map<string, Session[]>();

    for (const session of sessions) {
      const list = sessionMap.get(session.pathItemId) || [];
      list.push(session);
      sessionMap.set(session.pathItemId, list);
    }

    for (const p of paths) {
      const pItems = itemsByPath[p.id] || [];
      const itemMap = new Map(pItems.map((it) => [it.id, it]));

      let latestSession: Session | null = null;
      for (const item of pItems) {
        const itemSessions = sessionMap.get(item.id) || [];
        for (const s of itemSessions) {
          if (!latestSession || new Date(s.date).getTime() > new Date(latestSession.date).getTime()) {
            latestSession = s;
          }
        }
      }

      if (latestSession && itemMap.has(latestSession.pathItemId)) {
        map.set(p.id, {
          itemTitle: itemMap.get(latestSession.pathItemId)!.title,
          date: latestSession.date
        });
      } else {
        const doneItems = pItems.filter((i) => i.status === 'done').sort((a, b) => b.order - a.order);
        if (doneItems.length > 0) {
          map.set(p.id, {
            itemTitle: doneItems[0].title,
            date: doneItems[0].updatedAt
          });
        } else {
          map.set(p.id, null);
        }
      }
    }
    return map;
  }, [paths, itemsByPath, sessions]);

  const toggleExpand = (pathId: string) => {
    setExpandedPaths((prev) => ({ ...prev, [pathId]: !prev[pathId] }));
  };

  const handleStartSession = async (item: PathItem) => {
    const duration = item.estimatedDuration || 30;
    await startItem(item.id, 'learning', item.title, duration);
  };

  /** تحرير عنوان خطوة — الكتابة في الـDB عبر updateItem ثم إغلاق المحرر */
  const saveItemTitle = async (id: string) => {
    const value = editingItem?.id === id ? editingItem.value.trim() : '';
    if (value) await updateItem(id, { title: value });
    setEditingItem(null);
  };

  /** حذف خطوة بعد تأكيد — الطريق الوحيد للحذف: متجر التعلّم،
   *  والشريط يُفرَّغ عبر قناة التعلّم (removed) بلا نداء تحميل موضعي */
  const handleDeleteItem = async (id: string) => {
    setConfirmDeleteItem(null);
    await deleteItem(id);
  };

  const submitAddPath = async () => {
    const value = pathName.trim();
    if (!value) return;
    await addPath({
      title: value,
      type: pathType,
      status: 'active',
      order: paths.length + 1
    } as Omit<LearningPath, 'id' | 'createdAt' | 'updatedAt'>);
    setPathName('');
    setShowAddPath(false);
  };

  return (
    <section className="screen myplan-screen">
      <header className="screen-header">
        <h2 className="screen-title">{M.title}</h2>
        <p className="screen-subtitle muted">{M.subtitle}</p>
      </header>

      {/* بطاقات المواد/المسارات وخطواتها */}
      {paths.length === 0 ? (
        <Card>
          <EmptyState icon="📚">{M.empty}</EmptyState>
        </Card>
      ) : (
        <div className="myplan-grid">
          {paths.map((path) => {
            const items = itemsByPath[path.id] || [];
            const progress = pathProgress(items);
            const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);
            const pathSessionsCount = items.reduce(
              (acc, it) => acc + sessions.filter((s) => s.pathItemId === it.id).length,
              0
            );

            const pathNext = globalNextSteps.find((ns) => ns.path.id === path.id)?.item ||
              items.filter((i) => i.status !== 'done').sort((a, b) => a.order - b.order)[0];

            const lastStop = lastStopByPath.get(path.id);
            const isPathExpanded = !!expandedPaths[path.id];
            const isNextActive = activeTask?.kind === 'learning' && activeTask.id === pathNext?.id;

            return (
              <Card key={path.id} className={`myplan-subject-card status-${path.status}`}>
                <div className="myplan-card-header">
                  <div className="myplan-header-title">
                    <span className="myplan-type-icon">{L.types[path.type] || '📚'}</span>
                    <h3 className="myplan-title">{path.title}</h3>
                  </div>
                  <div className="myplan-header-chips">
                    <Chip>
                      {path.status === 'active'
                        ? M.activeTag
                        : path.status === 'paused'
                        ? M.pausedTag
                        : M.completedTag}
                    </Chip>
                    {pathSessionsCount > 0 && (
                      <Chip>{M.sessionsTotal.replace('{count}', String(pathSessionsCount))}</Chip>
                    )}
                  </div>
                </div>

                {progress.total > 0 && (
                  <div className="myplan-progress-block">
                    <div className="myplan-progress-bar-bg" aria-hidden="true">
                      <div
                        className="myplan-progress-bar-fill"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="myplan-progress-meta">
                      <span className="muted text-xs">
                        {M.progress
                          .replace('{done}', String(progress.done))
                          .replace('{total}', String(progress.total))
                          .replace('{percent}', String(percent))}
                      </span>
                    </div>
                  </div>
                )}

                <div className="myplan-last-stop">
                  <span className="myplan-label text-xs muted">{M.whereIStopped}</span>{' '}
                  {lastStop ? (
                    <span className="myplan-stop-value font-medium">
                      «{lastStop.itemTitle}»
                    </span>
                  ) : (
                    <span className="myplan-stop-empty muted text-xs">
                      {M.noPreviousSession}
                    </span>
                  )}
                </div>

                {progress.total === 0 ? (
                  // لا خطوات بعد — ليس «أنجزتِ كل شيء»
                  <p className="myplan-label text-xs">{M.noStepsYet}</p>
                ) : pathNext ? (
                  <div className="myplan-next-action-box">
                    <div className="myplan-next-details">
                      <span className="myplan-label text-xs muted">{M.nextAction}</span>
                      <div className="myplan-next-title-row">
                        <span className="myplan-next-title font-medium">{pathNext.title}</span>
                        {pathNext.estimatedDuration && (
                          <Chip>
                            {M.durationChip.replace('{minutes}', String(pathNext.estimatedDuration))}
                          </Chip>
                        )}
                        {pathNext.deadline && <ItemDeadlineChip item={pathNext} />}
                        {isNextActive && (
                          <span className="myplan-active-indicator" role="status">
                            {M.inProgressIndicator}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="myplan-action-btn-wrap">
                      <Button
                        size="sm"
                        variant={isNextActive ? 'soft' : 'primary'}
                        onClick={() => void handleStartSession(pathNext)}
                      >
                        {isNextActive ? M.continueSession : `⏱ ${M.startSession}`}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="myplan-all-done-banner text-xs">
                    {M.allDone}
                  </div>
                )}

                {items.length > 0 && (
                  <div className="myplan-expand-section">
                    <button
                      type="button"
                      className="details-toggle"
                      onClick={() => toggleExpand(path.id)}
                      aria-expanded={isPathExpanded}
                    >
                      {isPathExpanded ? `▲ ${M.collapseItems}` : `▼ ${M.expandItems} (${items.length})`}
                    </button>

                    {isPathExpanded && (
                      <ul className="myplan-items-list" aria-label={path.title}>
                        {items
                          .slice()
                          .sort((a, b) => a.order - b.order)
                          .map((item) => {
                            const isItemActive = activeTask?.kind === 'learning' && activeTask.id === item.id;
                            const isNext = pathNext?.id === item.id;
                            return (
                              <li
                                key={item.id}
                                className={`myplan-item-row status-${item.status}${isItemActive ? ' is-active' : ''}${isNext ? ' is-next' : ''}`}
                              >
                                <span className="myplan-item-status-icon">
                                  {item.status === 'done' ? '✓' : isItemActive ? '⏳' : '○'}
                                </span>
                                {editingItem?.id === item.id ? (
                                  <input
                                    className="text-input"
                                    value={editingItem.value}
                                    autoFocus
                                    aria-label={voice.common.edit}
                                    onChange={(e) => setEditingItem({ id: item.id, value: e.target.value })}
                                    onBlur={() => void saveItemTitle(item.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') void saveItemTitle(item.id);
                                      if (e.key === 'Escape') setEditingItem(null);
                                    }}
                                  />
                                ) : (
                                  <span
                                    className="myplan-item-title"
                                    role="button"
                                    tabIndex={0}
                                    style={{ cursor: 'pointer' }}
                                    title={voice.common.edit}
                                    onClick={() => setEditingItem({ id: item.id, value: item.title })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        setEditingItem({ id: item.id, value: item.title });
                                      }
                                    }}
                                  >
                                    {item.title}
                                  </span>
                                )}
                                {item.estimatedDuration && (
                                  <span className="muted text-xs">
                                    {M.durationChip.replace('{minutes}', String(item.estimatedDuration))}
                                  </span>
                                )}
                                <ItemDeadlineChip item={item} />
                                {item.status !== 'done' && (
                                  <Button
                                    size="sm"
                                    variant="soft"
                                    onClick={() => void completeItem(item.id)}
                                    title={M.markItemDone}
                                  >
                                    تم
                                  </Button>
                                )}
                                {item.status !== 'done' && !isItemActive && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void handleStartSession(item)}
                                    title={M.startSession}
                                  >
                                    ⏱
                                  </Button>
                                )}
                                {confirmDeleteItem === item.id ? (
                                  <>
                                    <span className="muted text-xs">{M.deleteItemConfirm}</span>
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() => void handleDeleteItem(item.id)}
                                    >
                                      {voice.common.delete}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setConfirmDeleteItem(null)}
                                    >
                                      {voice.common.cancel}
                                    </Button>
                                  </>
                                ) : (
                                  <button
                                    className="task-delete"
                                    aria-label={voice.common.delete}
                                    title={voice.common.delete}
                                    onClick={() => setConfirmDeleteItem(item.id)}
                                  >
                                    ×
                                  </button>
                                )}
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                )}

                {/* إدارة المسار — إضافة خطوة، إيقاف/استئناف، حذف */}
                <div className="banner-actions" style={{ marginTop: 'var(--space-3)' }}>
                  <Button
                    variant="soft"
                    onClick={() => setItemFormFor(itemFormFor === path.id ? null : path.id)}
                  >
                    ＋ {L.addItem}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void setPathStatus(path.id, path.status === 'active' ? 'paused' : 'active')}
                  >
                    {path.status === 'active' ? L.pause : L.activate}
                  </Button>
                  {confirmDeletePath === path.id ? (
                    <>
                      <span className="text-xs muted">{M.deletePathConfirm}</span>
                      <Button
                        variant="danger"
                        onClick={() => {
                          setConfirmDeletePath(null);
                          void deletePath(path.id);
                        }}
                      >
                        {voice.common.delete}
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmDeletePath(null)}>
                        {voice.common.cancel}
                      </Button>
                    </>
                  ) : (
                    <Button variant="danger" onClick={() => setConfirmDeletePath(path.id)}>
                      {voice.common.delete}
                    </Button>
                  )}
                </div>
                {itemFormFor === path.id && (
                  <ItemForm
                    pathId={path.id}
                    nextOrder={items.length ? Math.max(...items.map((i) => i.order)) + 1 : 1}
                    onDone={() => setItemFormFor(null)}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* مسار جديد — يفتح عند الطلب */}
      {showAddPath ? (
        <Card title={L.addPathTitle} icon="➕">
          <div className="add-form">
            <input
              className="text-input"
              placeholder={L.pathName}
              aria-label={L.pathName}
              value={pathName}
              autoFocus
              onChange={(e) => setPathName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitAddPath();
              }}
            />
            <div className="form-row">
              <div className="form-field">
                <label>{L.pathType}</label>
                <select
                  className="text-input"
                  value={pathType}
                  onChange={(e) => setPathType(e.target.value as LearningPathType)}
                >
                  {PATH_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {L.types[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field" style={{ alignSelf: 'flex-end' }}>
                <Button onClick={() => void submitAddPath()}>{L.addPath}</Button>
              </div>
            </div>
            <div className="row">
              <Button variant="ghost" size="sm" onClick={() => setShowAddPath(false)}>
                {voice.common.cancel}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="row" style={{ justifyContent: 'center' }}>
          <Button variant="soft" onClick={() => setShowAddPath(true)}>＋ {L.addPathTitle}</Button>
        </div>
      )}
    </section>
  );
}

/** نموذج إضافة خطوة إلى مسار — مورود من شاشة «رحلتي» القديمة */
function ItemForm({ pathId, nextOrder, onDone }: { pathId: string; nextOrder: number; onDone: () => void }) {
  const addItem = useLearningStore((s) => s.addItem);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  /** الموعد النهائي الاختياري — ظهيرةً محليًّا كما في المهام (لا إزاحة يوم) */
  const [deadline, setDeadline] = useState('');

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    await addItem({
      pathId,
      title: value,
      order: nextOrder,
      status: 'todo',
      estimatedDuration: duration,
      deadline: deadline ? new Date(`${deadline}T12:00:00`).toISOString() : undefined
    } as Omit<PathItem, 'id' | 'createdAt' | 'updatedAt'>);
    setTitle('');
    setDuration(30);
    setDeadline('');
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
          autoFocus
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
        <div className="form-field" style={{ minWidth: 150, maxWidth: 200 }}>
          <input
            className="text-input"
            type="date"
            title={M.itemDeadline}
            aria-label={M.itemDeadline}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        {deadline && (
          <Button variant="ghost" size="sm" onClick={() => setDeadline('')}>
            {M.clearDeadline}
          </Button>
        )}
        <Button variant="soft" onClick={() => void submit()}>
          {L.addItem}
        </Button>
      </div>
    </div>
  );
}

