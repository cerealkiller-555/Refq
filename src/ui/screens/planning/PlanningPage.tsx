// ============================================================
// رِفق — Screen: التخطيط (Planning)
// تقويم مستقل بثلاثة عروض (اليوم/الأسبوع/الشهر) في CalendarView.
// والمهام المجدولة تظهر هنا مع الأحداث داخل التقويم.
// ============================================================

import { useEffect, useState } from 'react';
import { usePlanningStore, todayKey } from '../../../core/store/usePlanningStore';
import { voice } from '../../../i18n/voice';
import { CalendarView } from './CalendarView';

type Tab = 'day' | 'week' | 'month';

export function PlanningPage() {
  const load = usePlanningStore((s) => s.load);
  const [tab, setTab] = useState<Tab>('day');
  /** اليوم المرجعي للتقويم — يتغير عند التنقل أو الضغط على يوم في الأسبوع/الشهر */
  const [anchor, setAnchor] = useState(todayKey());

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="screen">
      <h2 className="screen-title">{voice.planning.title}</h2>

      {/* التقويبات — ثلاثة عروض فقط */}
      <div className="tabs" role="tablist">
        {(['day', 'week', 'month'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {voice.planning.calendar.tabs[t]}
          </button>
        ))}
      </div>

      <CalendarView
        view={tab}
        anchorKey={anchor}
        onOpenDay={(key) => {
          setAnchor(key);
          setTab('day');
        }}
      />
    </section>
  );
}
