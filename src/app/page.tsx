'use client';

import { useEffect, useState } from 'react';
import { TIMEZONES } from '@/lib/timezones';
import ShareCard from '@/components/ShareCard';

const ELEMENT_COLORS: Record<string, string> = {
  Wood: '#58c15e',
  Fire: '#ff7043',
  Earth: '#ffb830',
  Metal: '#9fb2bd',
  Water: '#4fc3f7',
};
const ELEMENTS = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

type TenGod = { ko: string; rom: string; en: string };
type Pillar = {
  stem: { han: string; rom: string; element: string; yin: boolean };
  branch: { han: string; rom: string; element: string; animal: string };
  tenGod: TenGod | null;
  branchTenGod: TenGod;
  hidden: { han: string; rom: string; element: string }[];
  stage: { ko: string; rom: string; en: string };
} | null;

type DaeunPillar = {
  age: number;
  stem: { han: string; rom: string; element: string };
  branch: { han: string; rom: string; element: string; animal: string };
  tenGod: TenGod;
};
type SaeunPillar = {
  year: number;
  stem: { han: string; rom: string; element: string };
  branch: { han: string; rom: string; element: string; animal: string };
  tenGod: TenGod;
};
type Sinsal = { ko: string; rom: string; en: string; desc: string; where: string[] };

interface Chart {
  sajuYear: number;
  zodiacAnimal: string;
  hasHour: boolean;
  dayMaster: { han: string; rom: string; element: string; yin: boolean };
  archetype: { key: string; emoji: string; name: string; tagline: string; vibe: string };
  elementCounts: Record<string, number>;
  dominantElement: string;
  lackingElements: string[];
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar };
  daeun: { forward: boolean; startAge: number; pillars: DaeunPillar[] };
  saeun: SaeunPillar[];
  currentSaeun: SaeunPillar;
  sinsal: Sinsal[];
}

interface FreeReading {
  shareLine: string;
  overview: string;
  personality: {
    summary: string;
    traits: string[];
    strengths: string[];
    weaknesses: string[];
    innerConflict: string;
  };
  elementNote: string;
}

interface DetailedReading {
  yearFortune: string;
  compatibility: string;
  benefactors: string;
  cautions: string;
  career: string;
  wealth: string;
  relationships: string;
  health: string;
  lifePhases: string;
  luckyElements: string;
  advice: string[];
}

const STORAGE_KEY = 'saju.birth';

export default function Home() {
  const now = new Date();
  const [form, setForm] = useState({
    name: '',
    gender: '',
    year: 1995,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    timeUnknown: false,
    tzOffset: 9,
    birthplace: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chart, setChart] = useState<Chart | null>(null);
  const [free, setFree] = useState<FreeReading | null>(null);

  const [unlocking, setUnlocking] = useState(false);
  const [compatCopied, setCompatCopied] = useState(false);
  const [detailed, setDetailed] = useState<DetailedReading | null>(null);
  const [detailError, setDetailError] = useState('');

  // On return from Stripe success, recompute + fetch the detailed reading.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid') === '1') {
      const sessionId = params.get('session_id') || '';
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const birth = JSON.parse(saved);
        // Re-run the free reading so the page is populated, then unlock.
        runReading(birth, true, sessionId);
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function runReading(birth: typeof form, alsoDetailed = false, sessionId = '') {
    setLoading(true);
    setError('');
    setChart(null);
    setFree(null);
    setDetailed(null);
    setDetailError('');
    try {
      const res = await fetch('/api/saju', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(birth),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setChart(data.chart);
      setFree(data.reading);
      if (alsoDetailed) await fetchDetailed(birth, sessionId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    runReading(form);
  }

  async function fetchDetailed(birth: typeof form, sessionId: string) {
    setUnlocking(true);
    setDetailError('');
    try {
      const res = await fetch('/api/detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not unlock the detailed reading.');
      setDetailed(data.reading);
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setUnlocking(false);
    }
  }

  async function startCheckout() {
    setUnlocking(true);
    setDetailError('');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    try {
      const res = await fetch('/api/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.demo) {
        // No Stripe configured → unlock directly for the demo.
        await fetchDetailed(form, '');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data.error || 'Could not start checkout.');
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setUnlocking(false);
    }
  }

  const maxCount = chart ? Math.max(1, ...Object.values(chart.elementCounts)) : 1;

  return (
    <div className="wrap">
      <header className="hero">
        <div className="mark">✦ your k-destiny era ✦</div>
        <h1>
          Saju <span className="kr">사주</span>
        </h1>
        <p>
          Your birth chart, but make it <b>K</b> ✨ — the 1,000-year-old Korean cosmic
          personality read. Drop your birth time, meet your <b>Saju type</b>, and get read
          like your bestie has known you for lifetimes.
        </p>
      </header>

      <form className="card" onSubmit={onSubmit}>
        <h2>Your birth details</h2>
        <p className="sub">
          Saju is built from the exact moment and place of birth. The more precise, the better.
        </p>

        <div className="grid">
          <div>
            <label>Name (optional)</label>
            <input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Alex"
            />
          </div>
          <div>
            <label>Gender (optional)</label>
            <select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="full">
            <label>Date of birth</label>
            <div className="row3">
              <input
                type="number"
                min={1900}
                max={2100}
                value={form.year}
                onChange={(e) => update('year', Number(e.target.value))}
                aria-label="Year"
                placeholder="Year"
              />
              <select value={form.month} onChange={(e) => update('month', Number(e.target.value))} aria-label="Month">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select value={form.day} onChange={(e) => update('day', Number(e.target.value))} aria-label="Day">
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label>Hour (24h)</label>
            <select
              value={form.hour}
              disabled={form.timeUnknown}
              onChange={(e) => update('hour', Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <div className="checkbox">
              <input
                id="tu"
                type="checkbox"
                checked={form.timeUnknown}
                onChange={(e) => update('timeUnknown', e.target.checked)}
              />
              <label htmlFor="tu" style={{ margin: 0 }}>
                I don&apos;t know my birth time
              </label>
            </div>
          </div>
          <div>
            <label>Minute</label>
            <input
              type="number"
              min={0}
              max={59}
              value={form.minute}
              disabled={form.timeUnknown}
              onChange={(e) => update('minute', Number(e.target.value))}
            />
          </div>

          <div className="full">
            <label>Birth timezone</label>
            <select value={form.tzOffset} onChange={(e) => update('tzOffset', Number(e.target.value))}>
              {TIMEZONES.map((tz) => (
                <option key={tz.label} value={tz.offset}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          <div className="full">
            <label>Birthplace (optional)</label>
            <input
              value={form.birthplace}
              onChange={(e) => update('birthplace', e.target.value)}
              placeholder="e.g. Seoul, South Korea"
            />
          </div>
        </div>

        <button className="btn" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : '✦'} {loading ? 'Reading the stars…' : 'Reveal my Saju'}
        </button>

        {error && <div className="error">{error}</div>}
      </form>

      {chart && free && (
        <>
          {/* Saju type hero — the shareable identity */}
          <section className="type-hero">
            <div className="te">{chart.archetype.emoji}</div>
            <div className="tn">{chart.archetype.name}</div>
            <div className="tt">{chart.archetype.tagline}</div>
            {free.shareLine && <p className="share-line">{free.shareLine}</p>}
            <ShareCard
              data={{
                name: form.name || undefined,
                archetype: chart.archetype,
                dayMaster: chart.dayMaster,
                zodiacAnimal: chart.zodiacAnimal,
                elementCounts: chart.elementCounts,
                pillars: chart.pillars,
                shareLine: free.shareLine,
              }}
            />
          </section>

          {/* Chart */}
          <section className="card">
            <h2>Your Four Pillars</h2>
            <p className="sub">사주팔자 — the cosmic signature of your birth moment.</p>

            <div className="facts">
              <span className="chip">
                Zodiac: <b>{chart.zodiacAnimal}</b>
              </span>
              <span className="chip">
                Day Master: <b>{chart.dayMaster.rom} ({chart.dayMaster.han})</b>
              </span>
              <span className="chip">
                Element: <b>{chart.dayMaster.yin ? 'Yin' : 'Yang'} {chart.dayMaster.element}</b>
              </span>
            </div>

            <div className="pillars">
              {([
                ['Hour', chart.pillars.hour],
                ['Day', chart.pillars.day],
                ['Month', chart.pillars.month],
                ['Year', chart.pillars.year],
              ] as [string, Pillar][]).map(([tag, p]) => (
                <div className="pillar" key={tag}>
                  <div className="tag">{tag}</div>
                  {p ? (
                    <>
                      <div className="god top">{p.tenGod ? p.tenGod.en : 'Self'}</div>
                      <div className="char" style={{ background: ELEMENT_COLORS[p.stem.element] }}>
                        {p.stem.han}
                      </div>
                      <div className="char" style={{ background: ELEMENT_COLORS[p.branch.element] }}>
                        {p.branch.han}
                      </div>
                      <div className="rom">
                        {p.stem.rom}-{p.branch.rom}
                      </div>
                      <div className="god">{p.branchTenGod.en}</div>
                      <div className="meta">
                        {p.stage.en} · {p.branch.animal}
                      </div>
                      <div className="hidden">{p.hidden.map((h) => h.han).join(' ')}</div>
                    </>
                  ) : (
                    <>
                      <div className="char" style={{ opacity: 0.25 }}>
                        ?
                      </div>
                      <div className="char" style={{ opacity: 0.25 }}>
                        ?
                      </div>
                      <div className="rom">time unknown</div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p className="legend">
              Top &amp; bottom labels are the <b>Ten Gods (십성)</b>; small text is the{' '}
              <b>life stage (십이운성)</b>, zodiac animal, and <b>hidden stems (지장간)</b>.
            </p>

            <h3 style={{ color: 'var(--accent)', marginTop: 22 }}>Five-Element Balance (오행)</h3>
            <div className="bars">
              {ELEMENTS.map((el) => (
                <div className="bar-row" key={el}>
                  <span className="name">{el}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(chart.elementCounts[el] / maxCount) * 100}%`,
                        background: ELEMENT_COLORS[el],
                      }}
                    />
                  </div>
                  <span className="num">{chart.elementCounts[el]}</span>
                </div>
              ))}
            </div>

            {chart.sinsal.length > 0 && (
              <>
                <h3 style={{ color: 'var(--accent)', marginTop: 22 }}>Spirit Stars (신살)</h3>
                <div className="sinsal">
                  {chart.sinsal.map((s) => (
                    <div className="sinsal-item" key={s.ko} title={s.where.join(', ')}>
                      <b>
                        {s.en} <span className="kr-sm">{s.ko}</span>
                      </b>
                      <span>{s.desc}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3 style={{ color: 'var(--accent)', marginTop: 22 }}>
              Major Luck Cycles · 대운{' '}
              <span className="kr-sm">({chart.daeun.forward ? 'forward' : 'reverse'})</span>
            </h3>
            <div className="daeun">
              {chart.daeun.pillars.map((d) => (
                <div className="daeun-cell" key={d.age}>
                  <div className="age">age {d.age}</div>
                  <div className="dchar" style={{ background: ELEMENT_COLORS[d.stem.element] }}>
                    {d.stem.han}
                  </div>
                  <div className="dchar" style={{ background: ELEMENT_COLORS[d.branch.element] }}>
                    {d.branch.han}
                  </div>
                  <div className="dgod">{d.tenGod.en}</div>
                </div>
              ))}
            </div>

            <h3 style={{ color: 'var(--accent)', marginTop: 22 }}>Yearly Luck · 세운</h3>
            <div className="daeun">
              {chart.saeun.map((s) => (
                <div
                  className={`daeun-cell${s.year === chart.currentSaeun.year ? ' now' : ''}`}
                  key={s.year}
                >
                  <div className="age">{s.year}</div>
                  <div className="dchar" style={{ background: ELEMENT_COLORS[s.stem.element] }}>
                    {s.stem.han}
                  </div>
                  <div className="dchar" style={{ background: ELEMENT_COLORS[s.branch.element] }}>
                    {s.branch.han}
                  </div>
                  <div className="dgod">{s.tenGod.en}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Free reading */}
          <section className="card reading">
            <h2>Here&apos;s what I see in your chart</h2>
            <p className="sub">Read for you, like a friend would.</p>

            <h3>Overview</h3>
            {free.overview.split('\n').filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}

            <h3>Personality</h3>
            <p>{free.personality.summary}</p>

            <h4 className="mini">Your traits</h4>
            <div className="tags">
              {free.personality.traits.map((t, i) => (
                <span className="trait" key={i}>
                  {t}
                </span>
              ))}
            </div>

            <h4 className="mini">Strengths</h4>
            <div className="tags">
              {free.personality.strengths.map((s, i) => (
                <span className="pos" key={i}>
                  + {s}
                </span>
              ))}
            </div>

            <h4 className="mini">Weaknesses</h4>
            <div className="tags">
              {free.personality.weaknesses.map((w, i) => (
                <span className="neg" key={i}>
                  △ {w}
                </span>
              ))}
            </div>

            <h4 className="mini">Your inner conflict</h4>
            <p>{free.personality.innerConflict}</p>

            <h3>Element Balance</h3>
            <p>{free.elementNote}</p>
          </section>

          {/* Detailed / paywall */}
          {detailed ? (
            <section className="card reading">
              <h2>✦ Your Detailed Destiny Report</h2>
              <p className="sub">The full, premium interpretation of your Four Pillars.</p>

              <h3>This Year ({new Date().getFullYear()})</h3>
              <p>{detailed.yearFortune}</p>
              <h3>Compatibility with Others</h3>
              <p>{detailed.compatibility}</p>
              <h3>Your Benefactors (귀인)</h3>
              <p>{detailed.benefactors}</p>
              <h3>What to Be Careful Of</h3>
              <p>{detailed.cautions}</p>

              <h3>Career &amp; Calling</h3>
              <p>{detailed.career}</p>
              <h3>Wealth &amp; Prosperity</h3>
              <p>{detailed.wealth}</p>
              <h3>Love &amp; Relationships</h3>
              <p>{detailed.relationships}</p>
              <h3>Health &amp; Constitution</h3>
              <p>{detailed.health}</p>
              <h3>Life Phases</h3>
              <p>{detailed.lifePhases}</p>
              <h3>Lucky Elements</h3>
              <p>{detailed.luckyElements}</p>
              <h3>Guidance</h3>
              <ul className="advice">
                {detailed.advice.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="paywall">
              <div className="mark" style={{ color: 'var(--accent)' }}>
                ✦ unlock your full lore ✦
              </div>
              <h2 style={{ margin: '6px 0' }}>The Full Destiny Report</h2>
              <div className="price">
                $9 <small>· one-time, yours forever</small>
              </div>
              <ul>
                <li>Your {new Date().getFullYear()} forecast — is it your year or nah</li>
                <li>Compatibility — who lifts you up, who drains your battery</li>
                <li>Your 귀인 (destined allies) &amp; the red flags to walk away from</li>
                <li>Career, money, love, health &amp; your life-era timeline</li>
                <li>Your lucky elements — colors, seasons, moves that hit different</li>
              </ul>
              <button className="btn secondary" onClick={startCheckout} disabled={unlocking}>
                {unlocking ? <span className="spinner" /> : '🔮'}{' '}
                {unlocking ? 'Reading the stars…' : 'Unlock my full reading'}
              </button>
              {detailError && <div className="error">{detailError}</div>}
              <div className="demo-note">Secure checkout via Stripe.</div>
            </section>
          )}

          {/* 궁합 — friend compatibility (the viral loop) */}
          <section className="compat-cta">
            <h2>💘 Check your 궁합 with a friend</h2>
            <p>
              Send your match link — they drop their birth time, and you both find out if
              you&apos;re written in the stars (or a chaotic duo).
            </p>
            <button
              className="btn"
              onClick={async () => {
                const { encodeBirth } = await import('@/lib/encode');
                const link = `${window.location.origin}/compare?me=${encodeBirth(form)}`;
                await navigator.clipboard.writeText(link);
                setCompatCopied(true);
                setTimeout(() => setCompatCopied(false), 1800);
              }}
            >
              {compatCopied ? '✓ Link copied — send it!' : '🔗 Copy my match link'}
            </button>
          </section>
        </>
      )}

      <footer className="foot">
        <p>
          Saju is a tool for reflection and self-understanding, offered for entertainment and
          cultural insight — not a prediction of fixed fate.
        </p>
      </footer>
    </div>
  );
}
