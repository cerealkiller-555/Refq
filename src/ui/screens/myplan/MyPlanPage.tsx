// ============================================================
// رِفق — Screen: خطتي (My Plan)
// واجهة تنفيذية للمواد والمسارات الدراسية — خطوة واحدة وجلسة هادئة.
// تستند بالكامل على عناصر LearningPath وPathItem وSession القائمة
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useLearningStore } from '../../../core/store/useLearningStore';
import { useActiveTaskStore } from '../../../core/store/useActiveTaskStore';
import { nextSteps, pathProgress } from '../../../core/engines/learningEngine';
import { voice } from '../../../i18n/voice';
import { Card, Button, Chip, EmptyState } from '../../components';
import type { PathItem, Session } from '../../../core/types';

const M = voice.myPlan;
const L = voice.learning;

export function MyPlanPage() {
  const paths = useLearningStore((s) => s.paths);
  const itemsByPath = useLearningStore((s) => s.itemsByPath);
  const sessions = useLearningStore((s) => s.sessions);
  const load = useLearningStore((s) => s.load);

  const activeTask = useActiveTaskStore((s) => s.active);
  const startItem = useActiveTaskStore((s) => s.startItem);

  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});

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

  return (
    <section className="screen myplan-screen">
      <header className="screen-header">
        <h2 className="screen-title">{M.title}</h2>
        <p className="screen-subtitle muted">{M.subtitle}</p>
      </header>

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

                {pathNext ? (
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
                                <span className="myplan-item-title">{item.title}</span>
                                {item.estimatedDuration && (
                                  <span className="muted text-xs">
                                    {M.durationChip.replace('{minutes}', String(item.estimatedDuration))}
                                  </span>
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
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
