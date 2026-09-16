// ============================================================
// رِفق — Screen: القلب (Heart)
// أثر · فتش عن قلبك · وقفة · محاسبة · نصوص شرعية
// نبرة هادئة بلا ضغط — تأمل بلا أحكام.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useHeartStore } from '../../../core/store/useHeartStore';
import { useShariaStore } from '../../../core/store/useShariaStore';
import { useLearningStore } from '../../../core/store/useLearningStore';
import { voice } from '../../../i18n/voice';
import { Card, Button, Chip, EmptyState } from '../../components';
import type { ReflectionEntry, ShariaText, ShariaTextKind } from '../../../core/types';

const H = voice.heart;

type Tab = 'athar' | 'search_heart' | 'waqfa' | 'muhasaba' | 'sharia';

/** أثر — بعد إنجاز خطوة تعليمية */
function AtharForm({ linkedItemName, linkedItemId }: { linkedItemName?: string; linkedItemId?: string }) {
  const addReflection = useHeartStore((s) => s.addReflection);
  const [feeling, setFeeling] = useState('');
  const [benefit, setBenefit] = useState('');
  const [done, setDone] = useState(false);

  const save = async () => {
    await addReflection('athar', { feeling, benefit }, { linkedPathItemId: linkedItemId });
    setDone(true);
    setFeeling('');
    setBenefit('');
  };

  if (done) {
    return (
      <div className="banner banner-gentle">
        <p>{H.athar.done}</p>
      </div>
    );
  }

  return (
    <div className="add-form">
      {linkedItemName && <p className="muted">{H.athar.afterItem.replace('{item}', linkedItemName)}</p>}
      <p className="section-divider">{H.athar.hint}</p>
      <textarea className="text-input" rows={3} placeholder={H.athar.prompt} aria-label={H.athar.prompt} value={feeling} onChange={(e) => setFeeling(e.target.value)} />
      <textarea className="text-input" rows={2} placeholder={H.athar.benefit} aria-label={H.athar.benefit} value={benefit} onChange={(e) => setBenefit(e.target.value)} />
      <div className="banner-actions">
        <Button onClick={() => void save()}>{H.athar.save}</Button>
        <Button variant="ghost" onClick={() => void addReflection('athar', {}, { skipped: true })}>{H.athar.skip}</Button>
      </div>
    </div>
  );
}

/** فتش عن قلبك — سؤال دوري هادئ */
function SearchHeartForm() {
  const addReflection = useHeartStore((s) => s.addReflection);
  const [need, setNeed] = useState('');
  const [done, setDone] = useState(false);

  const save = async () => {
    await addReflection('search_heart', { need });
    setDone(true);
    setNeed('');
  };

  if (done) {
    return (
      <div className="banner banner-gentle">
        <p>{H.search_heart.saved}</p>
      </div>
    );
  }

  return (
    <div className="add-form">
      <p className="section-divider">{H.search_heart.hint}</p>
      <p>{H.search_heart.prompt}</p>
      <div className="reason-chips">
        {H.search_heart.options.map((opt) => (
          <button key={opt} className={`chip${need === opt ? ' chip-selected' : ''}`} onClick={() => setNeed(opt)}>{opt}</button>
        ))}
      </div>
      <div className="banner-actions">
        <Button onClick={() => void save()} disabled={!need}>{H.search_heart.save}</Button>
        <Button variant="ghost" onClick={() => void addReflection('search_heart', {}, { skipped: true })}>{H.search_heart.skip}</Button>
      </div>
    </div>
  );
}

/** وقفة — تأمل أسبوعي هادئ، بلا تقديرات */
function WaqfaForm() {
  const addReflection = useHeartStore((s) => s.addReflection);
  const [wins, setWins] = useState("");
  const [challenge, setChallenge] = useState("");
  const [nextWeek, setNextWeek] = useState("");
  const [done, setDone] = useState(false);

  const save = async () => {
    await addReflection("waqfa", { wins, challenge, nextWeek });
    setDone(true);
    setWins("");
    setChallenge("");
    setNextWeek("");
  };

  if (done) {
    return (
      <div className="banner banner-gentle">
        <p>{H.waqfa.saved}</p>
      </div>
    );
  }

  return (
    <div className="add-form">
      <p className="section-divider">{H.waqfa.hint}</p>
      <label className="form-field">
        <span>{H.waqfa.prompt}</span>
        <textarea className="text-input" rows={2} placeholder={H.waqfa.wins} aria-label={H.waqfa.prompt} value={wins} onChange={(e) => setWins(e.target.value)} />
      </label>
      <label className="form-field">
        <span>{H.waqfa.challenge}</span>
        <textarea className="text-input" rows={2} aria-label={H.waqfa.challenge} value={challenge} onChange={(e) => setChallenge(e.target.value)} />
      </label>
      <label className="form-field">
        <span>{H.waqfa.nextWeek}</span>
        <textarea className="text-input" rows={2} aria-label={H.waqfa.nextWeek} value={nextWeek} onChange={(e) => setNextWeek(e.target.value)} />
      </label>
      <div className="banner-actions">
        <Button onClick={() => void save()}>{H.waqfa.save}</Button>
        <Button variant="ghost" onClick={() => void addReflection("waqfa", {}, { skipped: true })}>{H.waqfa.skip}</Button>
      </div>
    </div>
  );
}

/** محاسبة — تأمل اختياري هادئ بلا أحكام */
function MuhasabaForm() {
  const addReflection = useHeartStore((s) => s.addReflection);
  const [good, setGood] = useState("");
  const [improvement, setImprovement] = useState("");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await addReflection("muhasaba", { good, improvement });
    setSaved(true);
    setGood("");
    setImprovement("");
  };

  if (saved) {
    return (
      <div className="banner banner-gentle">
        <p>{H.muhasaba.saved}</p>
      </div>
    );
  }

  return (
    <div className="add-form">
      <p className="section-divider">{H.muhasaba.hint}</p>
      <label className="form-field">
        <span>{H.muhasaba.prompt}</span>
        <textarea className="text-input" rows={3} aria-label={H.muhasaba.prompt} value={good} onChange={(e) => setGood(e.target.value)} />
      </label>
      <label className="form-field">
        <span>{H.muhasaba.improvement}</span>
        <textarea className="text-input" rows={2} aria-label={H.muhasaba.improvement} value={improvement} onChange={(e) => setImprovement(e.target.value)} />
      </label>
      <div className="banner-actions">
        <Button onClick={() => void save()}>{H.muhasaba.save}</Button>
        <Button variant="ghost" onClick={() => void addReflection("muhasaba", {}, { skipped: true })}>{H.muhasaba.skip}</Button>
      </div>
    </div>
  );
}

/** النصوص الشرعية — آية/حديث/فائدة. المصدر إلزامي دائمًا. */
function ShariaSection() {
  const texts = useShariaStore((s) => s.texts);
  const load = useShariaStore((s) => s.load);
  const addText = useShariaStore((s) => s.addText);
  const deleteText = useShariaStore((s) => s.deleteText);
  const paths = useLearningStore((s) => s.paths);

  const [kind, setKind] = useState<ShariaTextKind>("ayah");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [pathId, setPathId] = useState("");

  useEffect(() => {
    void load();
  }, [load]);

  const canSave = text.trim().length > 0 && source.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    await addText(kind, text.trim(), source.trim(), pathId ? { pathId } : undefined);
    setText("");
    setSource("");
  };

  const pathTitle = (id?: string) => (id ? paths.find((p) => p.id === id)?.title : undefined);

  return (
    <div className="add-form">
      <p className="section-divider">{H.sharia.hint}</p>
      <div className="form-row">
        <select className="text-input" aria-label={H.sharia.kind} value={kind} onChange={(e) => setKind(e.target.value as ShariaTextKind)}>
          {(Object.keys(H.sharia.kinds) as ShariaTextKind[]).map((k) => (
            <option key={k} value={k}>{H.sharia.kinds[k]}</option>
          ))}
        </select>
        {paths.length > 0 && (
          <select className="text-input" aria-label={H.sharia.linkPathLabel} value={pathId} onChange={(e) => setPathId(e.target.value)}>
            <option value="">{H.sharia.noPath}</option>
            {paths.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        )}
      </div>
      <textarea className="text-input" rows={3} placeholder={H.sharia.text} aria-label={H.sharia.text} value={text} onChange={(e) => setText(e.target.value)} />
      <input className="text-input" placeholder={H.sharia.source} aria-label={H.sharia.source} value={source} onChange={(e) => setSource(e.target.value)} />
      <div className="banner-actions">
        <Button onClick={() => void save()} disabled={!canSave}>{H.sharia.save}</Button>
      </div>

      {texts.length === 0 ? (
        <EmptyState icon="🕌">{H.sharia.empty}</EmptyState>
      ) : (
        <div className="sharia-list">
          {texts.map((t: ShariaText) => (
            <div key={t.id} className="sharia-row">
              <div className="reason-chips">
                <Chip>{H.sharia.kinds[t.kind] ?? t.kind}</Chip>
                {pathTitle(t.pathId) && (
                  <Chip>{H.sharia.linkedPath.replace("{path}", pathTitle(t.pathId) ?? "")}</Chip>
                )}
              </div>
              <p className="sharia-text">{t.text}</p>
              <p className="muted">{t.source}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void deleteText(t.id)}
                ariaLabel={voice.common.delete}
                title={voice.common.delete}
              >
                {voice.common.delete}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** السجل — التأملات بهدوء، بلا أرقام ولا لوم */
function HistorySection({ reflections }: { reflections: ReflectionEntry[] }) {
  const sorted = [...reflections].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  if (sorted.length === 0) {
    return <p className="muted">{H.noHistory}</p>;
  }
  return (
    <div className="history-list">
      {sorted.slice(0, 20).map((r) => (
        <div key={r.id} className="history-row">
          <div className="reason-chips">
            <Chip>{H.tabs[r.kind] ?? r.kind}</Chip>
            <span className="muted">{r.date}</span>
          </div>
          {r.skipped ? (
            <p className="muted">{H.todayDone}</p>
          ) : (
            <p>{Object.values(r.answers).filter(Boolean).join(" · ")}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function HeartPage() {
  const [tab, setTab] = useState<Tab>("athar");
  const loadHeart = useHeartStore((s) => s.load);
  const reflections = useHeartStore((s) => s.reflections);
  const getTodayByKind = useHeartStore((s) => s.getTodayByKind);
  const loadLearning = useLearningStore((s) => s.load);
  const itemsByPath = useLearningStore((s) => s.itemsByPath);
  const [doneToday, setDoneToday] = useState(false);

  useEffect(() => {
    void loadHeart();
    void loadLearning();
  }, [loadHeart, loadLearning]);

  // آخر خطوة أُنجزت — يُربط بها "أثر" تلقائيًا بلطف
  const lastDoneItem = useMemo(() => {
    const all = Object.values(itemsByPath).flat();
    return all
      .filter((i) => i.status === "done")
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
  }, [itemsByPath]);

  useEffect(() => {
    if (tab === "sharia") return;
    let alive = true;
    void getTodayByKind(tab).then((entry) => {
      if (alive) setDoneToday(Boolean(entry));
    });
    return () => {
      alive = false;
    };
  }, [tab, getTodayByKind, reflections]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "athar", label: H.tabs.athar },
    { key: "search_heart", label: H.tabs.search_heart },
    { key: "waqfa", label: H.tabs.waqfa },
    { key: "muhasaba", label: H.tabs.muhasaba },
    { key: "sharia", label: H.tabs.sharia }
  ];

  return (
    <section className="screen">
      <h2 className="screen-title">{H.title}</h2>

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "sharia" && doneToday && <p className="muted">{H.todayDone}</p>}

      {tab === "athar" && (
        <Card title={H.athar.title} icon="🌱">
          <AtharForm linkedItemName={lastDoneItem?.title} linkedItemId={lastDoneItem?.id} />
        </Card>
      )}
      {tab === "search_heart" && (
        <Card title={H.search_heart.title} icon="💭">
          <SearchHeartForm />
        </Card>
      )}
      {tab === "waqfa" && (
        <Card title={H.waqfa.title} icon="🧭">
          <WaqfaForm />
        </Card>
      )}
      {tab === "muhasaba" && (
        <Card title={H.muhasaba.title} icon="🤍">
          <MuhasabaForm />
        </Card>
      )}
      {tab === "sharia" && (
        <Card title={H.sharia.title} icon="📖">
          <ShariaSection />
        </Card>
      )}

      <Card title={H.history} icon="🗂">
        <HistorySection reflections={reflections} />
      </Card>
    </section>
  );
}

export default HeartPage;
