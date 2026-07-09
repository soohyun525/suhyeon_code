'use client';

// 궁합 (compatibility) page. A friend arrives via a share link that carries
// person A's birth data (?me=...), enters their own, and both get the read.
// This page is the product's main viral loop: using it requires sharing it.

import { useEffect, useState } from 'react';
import { TIMEZONES } from '@/lib/timezones';
import { decodeBirth, type CompactBirth } from '@/lib/encode';

interface LitePerson {
  name: string | null;
  archetype: { emoji: string; name: string; tagline: string };
  dayMaster: { han: string; rom: string; element: string; yin: boolean };
  zodiacAnimal: string;
}

interface CompatResponse {
  a: LitePerson;
  b: LitePerson;
  score: number;
  label: string;
  factors: { label: string; detail: string; delta: number }[];
  reading: { vibe: string; strengths: string; watchouts: string; verdict: string };
}

export default function ComparePage() {
  const [inviter, setInviter] = useState<CompactBirth | null | 'none'>(null);
  const [form, setForm] = useState({
    name: '',
    gender: '',
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    timeUnknown: false,
    tzOffset: 9,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompatResponse | null>(null);

  useEffect(() => {
    const me = new URLSearchParams(window.location.search).get('me');
    setInviter(me ? decodeBirth(me) || 'none' : 'none');
  }, []);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviter || inviter === 'none') return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/compat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: inviter, b: form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const inviterName = inviter && inviter !== 'none' ? inviter.name || 'Your friend' : '';

  return (
    <div className="wrap">
      <header className="hero">
        <div className="mark">✦ saju 궁합 check ✦</div>
        <h1>
          Match <span className="kr">궁합</span>
        </h1>
        {inviter === 'none' ? (
          <p>
            This page needs a friend link. Get your own reading first, then send your{' '}
            <b>compare link</b> to a friend! 💌
          </p>
        ) : inviter ? (
          <p>
            <b>{inviterName}</b> wants to check your cosmic compatibility 👀 Drop your birth
            info and see if you two are written in the stars.
          </p>
        ) : (
          <p>Loading…</p>
        )}
      </header>

      {inviter === 'none' && (
        <section className="card" style={{ textAlign: 'center' }}>
          <h2>No invite attached 😅</h2>
          <p className="sub">Start your own reading and share your link from there.</p>
          <a href="/" className="btn" style={{ textDecoration: 'none', maxWidth: 360, margin: '10px auto 0' }}>
            ✦ Get my Saju reading
          </a>
        </section>
      )}

      {inviter && inviter !== 'none' && !result && (
        <form className="card" onSubmit={onSubmit}>
          <h2>Your birth details</h2>
          <p className="sub">Same rules — the more precise, the better the match read.</p>

          <div className="grid">
            <div>
              <label>Name (optional)</label>
              <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Minji" />
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
          </div>

          <button className="btn" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : '💘'} {loading ? 'Consulting the stars…' : 'Check our match'}
          </button>
          {error && <div className="error">{error}</div>}
        </form>
      )}

      {result && (
        <>
          <section className="card" style={{ textAlign: 'center' }}>
            <h2>The Verdict</h2>
            <div className="vs-row">
              <div className="vs-card">
                <div className="ve">{result.a.archetype.emoji}</div>
                <div className="vn">{result.a.name || 'Friend'}</div>
                <div className="vm">
                  {result.a.archetype.name} · {result.a.zodiacAnimal}
                </div>
              </div>
              <div className="vs-heart">💘</div>
              <div className="vs-card">
                <div className="ve">{result.b.archetype.emoji}</div>
                <div className="vn">{result.b.name || 'You'}</div>
                <div className="vm">
                  {result.b.archetype.name} · {result.b.zodiacAnimal}
                </div>
              </div>
            </div>

            <div className="score-wrap">
              <div className="score-num">{result.score}</div>
              <div className="score-label">{result.label}</div>
              <div className="score-track">
                <div className="score-fill" style={{ width: `${result.score}%` }} />
              </div>
            </div>

            <div className="compat-factors">
              {result.factors.map((f, i) => (
                <div className={`factor ${f.delta > 0 ? 'good' : 'bad'}`} key={i}>
                  <b>
                    {f.delta > 0 ? '+' : ''}
                    {f.delta} · {f.label}
                  </b>
                  <span>{f.detail}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card reading">
            <h2>What the stars say about you two</h2>
            <h3>The Vibe</h3>
            <p>{result.reading.vibe}</p>
            <h3>What Works</h3>
            <p>{result.reading.strengths}</p>
            <h3>Watch Out For</h3>
            <p>{result.reading.watchouts}</p>
            <h3>Final Verdict</h3>
            <p>{result.reading.verdict}</p>
          </section>

          <section className="compat-cta">
            <h2>Now it&apos;s your turn 🔮</h2>
            <p>Get your own full Saju reading — your type, your chart, your 2026.</p>
            <a href="/" className="btn" style={{ textDecoration: 'none' }}>
              ✦ Reveal my Saju
            </a>
          </section>
        </>
      )}

      <footer className="foot">
        <p>Saju is a tool for reflection and fun — not a verdict on any relationship.</p>
      </footer>
    </div>
  );
}
