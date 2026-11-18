'use client';

// 큐피트 — 내 에이전트가 상대 에이전트와 대화해서 첫 데이트를 잡아온다.
// 화면 전환은 SCREEN_FLOW, 각 후보와의 진행은 COURT_FLOW 표로만 움직인다.

import dynamic from 'next/dynamic';
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { ActionButton, Badge, Callout, Chip, TextField } from '@seed-design/react';
import gsap from 'gsap';
import { applyOwnerEvent, type OwnerEvent } from '@/lib/cupid/owner';
import { COURT_LABEL, COURT_STEPS, SCREEN_FLOW, canFire, type CourtState, type Screen } from '@/lib/cupid/machine';
import { SAMPLE_PROFILE } from '@/lib/cupid/sample';
import type { TasteRead } from '@/lib/cupid/insta';
import { ATTACH, CLOSENESS_ITEMS, CONFLICTS, CONTACTS, EMPTY_BOND, INTENTS, LEVELS, LOVE_LANGS, NEEDS, attachStyle, needLabel, type Level } from '@/lib/cupid/psych';
import { QUESTIONS } from '@/lib/cupid/questions';
import type { Insight } from '@/lib/cupid/interview';
import { parseProfile } from '@/lib/cupid/validate';
import {
  CITIES, DATE_STYLES, DAYS, DAY_LABEL, DEALBREAKERS, DRINKS, GENDERS, INTERESTS, PARTS, PART_LABEL, TONES, VALUES,
  type A2AMessage, type Courtship, type Profile, type SlotId,
} from '@/lib/cupid/types';
import Landing from './Landing';
import Logo from './Logo';
import { stage } from './stage';

const Scene = dynamic(() => import('./Scene'), { ssr: false });
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const STORE_KEY = 'cupid.profile.v1';
const EMPTY: Profile = {
  name: '', birth: { year: 0, month: 0, day: 0 }, gender: 'female', seeking: [], ageRange: [25, 35], city: '서울',
  interests: [], values: [], smoker: false, drink: 'social', likesPets: true, dealbreakers: [], dateStyles: [], slots: [], tone: 'witty', bond: EMPTY_BOND,
};

// 화면별 3D 여정 위치 (landing 은 스크롤이 0~0.6 을 직접 움직인다)
const STAGE_P: Record<Exclude<Screen, 'landing'>, number> = {
  connect: 0.62, reading: 0.64, persona: 0.65, onboarding: 0.66, interview: 0.69, analyzing: 0.71, insight: 0.72, briefing: 0.74, dispatching: 0.84, watching: 0.88, results: 0.92, proposal: 0.96,
};
const CRUMBS: { label: string; screens: Screen[] }[] = [
  { label: '프로필', screens: ['connect', 'reading', 'persona', 'onboarding', 'interview', 'analyzing', 'insight'] },
  { label: '브리핑', screens: ['briefing'] },
  { label: '대화', screens: ['dispatching', 'watching'] },
  { label: '결과', screens: ['results', 'proposal'] },
];

interface Ctx {
  screen: Screen;
  profile: Profile | null;
  courtships: Courtship[];
  voiced: boolean;
  openId: string | null;
  error: string | null;
  handle: string | null;
  taste: TasteRead | null;
  answers: Record<string, string> | null;
  insight: Insight | null;
}
type Action =
  | { type: 'PROFILE_SAVED'; profile: Profile }
  | { type: 'START' | 'HOME' | 'EDIT' | 'DISPATCH' | 'WATCHED' | 'BACK' | 'SKIP' | 'CONTINUE' | 'RETRY' }
  | { type: 'HANDLE_SENT'; handle: string }
  | { type: 'READ_OK'; taste: TasteRead }
  | { type: 'READ_FAILED'; error: string }
  | { type: 'ANSWERED'; answers: Record<string, string> }
  | { type: 'ANALYZED'; insight: Insight }
  | { type: 'ANALYZE_FAILED'; error: string }
  | { type: 'LOADED'; courtships: Courtship[]; voiced: boolean }
  | { type: 'FAILED'; error: string }
  | { type: 'OPEN'; id: string }
  | { type: 'OWNER'; id: string; event: OwnerEvent };

function reducer(ctx: Ctx, a: Action): Ctx {
  if (a.type === 'OWNER') {
    return {
      ...ctx,
      courtships: ctx.courtships.map((c) => (c.id === a.id && canFire(c.state, a.event) ? applyOwnerEvent(c, a.event) : c)),
    };
  }
  const screen = SCREEN_FLOW[ctx.screen][a.type];
  if (!screen) return ctx; // 표에 없는 전이는 무시
  const next: Ctx = { ...ctx, screen, error: null };
  if (a.type === 'PROFILE_SAVED') next.profile = a.profile;
  if (a.type === 'LOADED') Object.assign(next, { courtships: a.courtships, voiced: a.voiced });
  if (a.type === 'FAILED' || a.type === 'READ_FAILED' || a.type === 'ANALYZE_FAILED') next.error = a.error;
  if (a.type === 'ANSWERED') next.answers = a.answers;
  if (a.type === 'ANALYZED') {
    next.insight = a.insight;
    // 읽어낸 바람을 프로필에 넣는다 — 매칭의 "속마음" 요소가 이걸 쓴다
    if (next.profile) next.profile = { ...next.profile, bond: { ...next.profile.bond, needs: a.insight.needs } };
  }
  if (a.type === 'HANDLE_SENT') next.handle = a.handle;
  if (a.type === 'READ_OK') next.taste = a.taste;
  if (a.type === 'SKIP' && ctx.screen === 'connect') next.taste = null;
  if (a.type === 'OPEN') next.openId = a.id;
  return next;
}

export default function CupidPage() {
  const [ctx, send] = useReducer(reducer, {
    screen: 'landing', profile: null, courtships: [], voiced: false, openId: null, error: null, handle: null, taste: null, answers: null, insight: null,
  });
  const [saved, setSaved] = useState<Profile | null>(null);
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setSaved(parseProfile(JSON.parse(raw)));
    } catch {}
  }, []);

  // reading 상태에 들어오면 인스타그램을 읽는다.
  useEffect(() => {
    if (ctx.screen !== 'reading' || !ctx.handle) return;
    let live = true;
    fetch('/api/cupid/insta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle: ctx.handle }) })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (live) send({ type: 'READ_OK', taste: data.taste });
      })
      .catch((e) => live && send({ type: 'READ_FAILED', error: e?.message || '읽어오지 못했어요. 직접 입력으로 진행해주세요.' }));
    return () => {
      live = false;
    };
  }, [ctx.screen, ctx.handle]);

  // analyzing 상태에 들어오면 깊은 대화를 읽는다.
  useEffect(() => {
    if (ctx.screen !== 'analyzing' || !ctx.answers) return;
    let live = true;
    fetch('/api/cupid/interview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: ctx.answers }) })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (live) send({ type: 'ANALYZED', insight: data.insight });
      })
      .catch((e) => live && send({ type: 'ANALYZE_FAILED', error: e?.message || '이야기를 읽지 못했어요. 다시 시도해주세요.' }));
    return () => {
      live = false;
    };
  }, [ctx.screen, ctx.answers]);

  // dispatching 상태에 들어오면 에이전트를 보낸다.
  useEffect(() => {
    if (ctx.screen !== 'dispatching' || !ctx.profile) return;
    let live = true;
    fetch('/api/cupid/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: ctx.profile }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (live) send({ type: 'LOADED', courtships: data.courtships, voiced: data.voiced });
      })
      .catch((e) => live && send({ type: 'FAILED', error: e?.message || '연결에 실패했어요. 다시 시도해주세요.' }));
    return () => {
      live = false;
    };
  }, [ctx.screen, ctx.profile]);

  // 데모: 내가 승인하면 잠시 뒤 상대(가상 인물)도 승인한다.
  const waitingId = ctx.courtships.find((c) => c.state === 'awaiting_partner')?.id;
  useEffect(() => {
    if (!waitingId) return;
    const t = setTimeout(() => send({ type: 'OWNER', id: waitingId, event: 'PARTNER_APPROVE' }), 1800);
    return () => clearTimeout(t);
  }, [waitingId]);

  const open = ctx.courtships.find((c) => c.id === ctx.openId);
  const confirmedOpen = ctx.screen === 'proposal' && open?.state === 'confirmed';

  // 화면이 바뀌면: 맨 위로, 3D 여정 이동, 내용이 아래에서 올라온다.
  useIsoLayoutEffect(() => {
    window.scrollTo(0, 0);
    if (ctx.screen === 'landing') return;
    const talking = ctx.screen === 'dispatching' || ctx.screen === 'watching';
    gsap.to(stage, { p: STAGE_P[ctx.screen], pulse: talking ? 1 : 0, show: talking ? 1 : 0, duration: 1.6, ease: 'power2.inOut', overwrite: true });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = gsap.context(() => {
      gsap.from('[data-rise]', { y: 26, opacity: 0, duration: 0.75, ease: 'power3.out', stagger: 0.05, clearProps: 'all' });
    }, main);
    return () => c.revert();
  }, [ctx.screen]);

  // 확정 순간: 두 점이 만나고 고리가 퍼진다.
  useEffect(() => {
    if (!confirmedOpen) return;
    gsap.to(stage, { p: 1, show: 1, duration: 1.2, ease: 'power2.out', overwrite: true });
    gsap.fromTo(stage, { ring: 0.001 }, { ring: 1, duration: 1.6, ease: 'power2.out', onComplete: () => { stage.ring = 0; } });
    gsap.to(stage, { show: 0, duration: 1, delay: 2.4 }); // 만난 뒤에는 글 읽는 데 방해되지 않게 물러난다
  }, [confirmedOpen]);

  return (
    <>
      <Scene />
      <header className="cq-head cq-page">
        <button className="cq-mark" onClick={() => send({ type: 'HOME' })} aria-label="큐피트 처음으로"><Logo /></button>
        {ctx.screen !== 'landing' && (
          <ol className="cq-crumbs" aria-label="진행 순서">
            {CRUMBS.map((c, i) => (
              <li key={c.label} aria-current={c.screens.includes(ctx.screen) ? 'step' : undefined}>
                <span>{String(i + 1).padStart(2, '0')}</span> {c.label}
              </li>
            ))}
          </ol>
        )}
      </header>

      {ctx.screen === 'landing' ? (
        <Landing onStart={() => send({ type: 'START' })} />
      ) : (
        <main className="cq-page cq-app" ref={main}>
          {ctx.screen === 'connect' && (
            <Connect
              initial={ctx.handle ?? ''}
              error={ctx.error}
              onSend={(handle) => send({ type: 'HANDLE_SENT', handle })}
              onSkip={() => send({ type: 'SKIP' })}
            />
          )}
          {ctx.screen === 'reading' && (
            <section className="cq-wait" aria-live="polite">
              <p className="cq-kicker">01 — 프로필</p>
              <h1>@{ctx.handle}<br />읽는 중<span className="cq-dots3" aria-hidden><i>.</i><i>.</i><i>.</i></span></h1>
              <p>공개 게시물의 글에서 취향을 찾고 있어요.</p>
            </section>
          )}
          {ctx.screen === 'persona' && ctx.taste && (
            <Persona taste={ctx.taste} onContinue={() => send({ type: 'CONTINUE' })} onRetry={() => send({ type: 'RETRY' })} />
          )}
          {ctx.screen === 'onboarding' && (
            <Onboarding
              key={`${saved ? 'saved' : 'empty'}-${ctx.taste?.handle ?? ''}`}
              prefilled={!ctx.profile && !!ctx.taste}
              initial={ctx.profile ?? (ctx.taste
                ? { ...(saved ?? EMPTY), interests: ctx.taste.interests, values: ctx.taste.values, dateStyles: ctx.taste.dateStyles, tone: ctx.taste.tone }
                : saved ?? EMPTY)}
              onDone={(profile) => {
                try {
                  localStorage.setItem(STORE_KEY, JSON.stringify(profile));
                } catch {}
                send({ type: 'PROFILE_SAVED', profile });
              }}
            />
          )}
          {ctx.screen === 'interview' && (
            <Interview
              initial={ctx.answers ?? {}}
              error={ctx.error}
              onDone={(answers) => send({ type: 'ANSWERED', answers })}
              onSkip={() => send({ type: 'SKIP' })}
              onEdit={() => send({ type: 'EDIT' })}
            />
          )}
          {ctx.screen === 'analyzing' && (
            <section className="cq-wait" aria-live="polite">
              <p className="cq-kicker">01 — 프로필</p>
              <h1>이야기를<br />읽는 중<span className="cq-dots3" aria-hidden><i>.</i><i>.</i><i>.</i></span></h1>
              <p>말한 이상형이 아니라, 이야기에서 반복되는 바람을 찾고 있어요.</p>
            </section>
          )}
          {ctx.screen === 'insight' && ctx.insight && ctx.profile && (
            <InsightView insight={ctx.insight} profile={ctx.profile} onContinue={() => send({ type: 'CONTINUE' })} onRetry={() => send({ type: 'RETRY' })} />
          )}
          {ctx.screen === 'briefing' && ctx.profile && (
            <Briefing profile={ctx.profile} error={ctx.error} onEdit={() => send({ type: 'EDIT' })} onGo={() => send({ type: 'DISPATCH' })} />
          )}
          {ctx.screen === 'dispatching' && (
            <section className="cq-wait" aria-live="polite">
              <p className="cq-kicker">03 — 대화</p>
              <h1>에이전트가<br />출발했습니다<span className="cq-dots3" aria-hidden><i>.</i><i>.</i><i>.</i></span></h1>
              <p>조건이 맞는 상대의 에이전트를 찾고 있어요.</p>
            </section>
          )}
          {ctx.screen === 'watching' && ctx.profile && (
            <Watching me={ctx.profile.name} courtships={ctx.courtships} onDone={() => send({ type: 'WATCHED' })} />
          )}
          {ctx.screen === 'results' && (
            <Results
              courtships={ctx.courtships}
              onOpen={(id) => send({ type: 'OPEN', id })}
              onEdit={() => send({ type: 'EDIT' })}
              onAgain={() => send({ type: 'DISPATCH' })}
            />
          )}
          {ctx.screen === 'proposal' && open && ctx.profile && (
            <Detail
              me={ctx.profile.name}
              c={open}
              onBack={() => send({ type: 'BACK' })}
              onOwner={(event) => send({ type: 'OWNER', id: open.id, event })}
            />
          )}
        </main>
      )}
    </>
  );
}

// ── 공용 조각 ────────────────────────────────────────────────────

function Chips<T extends string>({ options, value, onToggle, label }: {
  options: { id: T; label: string }[];
  value: T[];
  onToggle: (id: T) => void;
  label: string;
}) {
  return (
    <div className="cq-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <Chip.Toggle key={o.id} variant="outlineStrong" size="medium" checked={value.includes(o.id)} onCheckedChange={() => onToggle(o.id)}>
          <Chip.Label>{o.label}</Chip.Label>
        </Chip.Toggle>
      ))}
    </div>
  );
}

/** 하나만 고르는 칩 */
function Pick<T extends string>({ options, value, onChange, label }: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <Chip.RadioRoot className="cq-chips" aria-label={label} value={value} onValueChange={(v) => onChange(v as T)}>
      {options.map((o) => (
        <Chip.RadioItem key={o.id} variant="outlineStrong" size="medium" value={o.id}>
          <Chip.Label>{o.label}</Chip.Label>
        </Chip.RadioItem>
      ))}
    </Chip.RadioRoot>
  );
}

function Num({ label, value, onChange, suffix, placeholder }: {
  label: string; value: number; onChange: (n: number) => void; suffix: string; placeholder?: string;
}) {
  return (
    <TextField.Root variant="underline" size="large" value={value ? String(value) : ''} onValueChange={(v) => onChange(Number(v.replace(/\D/g, '')) || 0)}>
      <TextField.Input aria-label={label} inputMode="numeric" placeholder={placeholder} />
      <TextField.SuffixText>{suffix}</TextField.SuffixText>
    </TextField.Root>
  );
}

function Go({ children, variant = 'brandSolid', ...rest }: React.ComponentProps<typeof ActionButton>) {
  return <ActionButton variant={variant} size="large" {...rest}>{children}</ActionButton>;
}

const plain = (xs: string[]) => xs.map((x) => ({ id: x, label: x }));
const toggle = <T,>(xs: T[], x: T, max = 99): T[] =>
  xs.includes(x) ? xs.filter((y) => y !== x) : xs.length >= max ? xs : [...xs, x];

function StateTag({ state }: { state: CourtState }) {
  const on = state === 'confirmed' || state === 'awaiting_owner' || state === 'awaiting_partner';
  return <Badge.Root tone={on ? 'brand' : 'neutral'} variant={state === 'confirmed' ? 'solid' : 'weak'} size="large"><Badge.Label>{COURT_LABEL[state]}</Badge.Label></Badge.Root>;
}

/** 7단계 진행 표시. 중간에 끝난 경우엔 끝난 이유를 마지막 줄에 붙인다. */
function Steps({ state }: { state: CourtState }) {
  const at = COURT_STEPS.findIndex((s) => s.state === state);
  return (
    <ol className="cq-steps" aria-label={`진행 단계: ${COURT_LABEL[state]}`}>
      {COURT_STEPS.map((s, i) => (
        <li key={s.state} className={at < 0 ? '' : i < at ? 'done' : i === at ? 'now' : ''}>{s.label}</li>
      ))}
      {at < 0 && <li className="end">{COURT_LABEL[state]}</li>}
    </ol>
  );
}

function Script({ messages, me, them }: { messages: A2AMessage[]; me: string; them: string }) {
  return (
    <ol className="cq-script">
      {messages.map((m, i) => (
        <li key={i} className={m.from}>
          <b>{m.from === 'mine' ? me : them}의 에이전트</b>
          <span>{m.text}</span>
        </li>
      ))}
    </ol>
  );
}

function Split({ kicker, title, lead, aside, children }: {
  kicker: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="cq-split">
      <div className="cq-aside">
        <p className="cq-kicker" data-rise>{kicker}</p>
        <h1 data-rise>{title}</h1>
        {lead && <p className="lead" data-rise>{lead}</p>}
        {aside && <div data-rise>{aside}</div>}
      </div>
      <div className="cq-main">{children}</div>
    </div>
  );
}

function Q({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="cq-q" data-rise>
      <div className="label">
        <span className="n">{String(n).padStart(2, '0')}</span>
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </div>
      <div className="field">{children}</div>
    </section>
  );
}

// ── 0. 인스타그램으로 시작 ───────────────────────────────────────

function Connect({ initial, error, onSend, onSkip }: { initial: string; error: string | null; onSend: (handle: string) => void; onSkip: () => void }) {
  const [handle, setHandle] = useState(initial);
  return (
    <Split
      kicker="01 — 프로필"
      title={<>인스타그램 아이디<br /><em>한 칸</em>이면 돼요</>}
      lead="공개 게시물의 글을 읽고 취향을 먼저 채워둘게요. 고치는 건 그다음에 하면 됩니다."
    >
      <form onSubmit={(e) => { e.preventDefault(); if (handle.trim()) onSend(handle.trim().replace(/^@/, '')); }} noValidate>
        <section className="cq-q" data-rise>
          <div className="label"><h2>내 인스타그램</h2><p>본인 계정만 입력해 주세요.</p></div>
          <div className="field">
            <TextField.Root variant="underline" size="large" value={handle} onValueChange={setHandle}>
              <TextField.PrefixText>@</TextField.PrefixText>
              <TextField.Input id="cq-insta" aria-label="인스타그램 아이디" placeholder="아이디" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={60} />
            </TextField.Root>
          </div>
        </section>
        <section className="cq-q" data-rise>
          <div className="label"><h2>읽는 범위</h2></div>
          <ul className="cq-plain field">
            <li>공개 게시물의 글과 해시태그만 읽어요. 사진 속 사람이나 위치는 보지 않아요.</li>
            <li>읽은 글은 취향을 고르는 데만 쓰고 저장하지 않아요.</li>
            <li>비공개 계정은 읽지 않아요. 그럴 땐 직접 고르면 됩니다.</li>
          </ul>
        </section>
        <div className="cq-submit" data-rise>
          {error && <Callout.Root tone="critical" role="alert"><Callout.Content><Callout.Description>{error}</Callout.Description></Callout.Content></Callout.Root>}
          <div className="cq-links">
            <Go type="submit" disabled={!handle.trim()}>내 취향 읽어보기</Go>
            <Go type="button" variant="ghost" onClick={onSkip}>직접 입력할게요</Go>
          </div>
        </div>
      </form>
    </Split>
  );
}

function Persona({ taste, onContinue, onRetry }: { taste: TasteRead; onContinue: () => void; onRetry: () => void }) {
  const [shared, setShared] = useState(false);
  const styleLabel = (id: string) => DATE_STYLES.find((d) => d.id === id)?.label ?? id;
  const share = async () => {
    const text = `큐피트가 읽은 나: ${taste.typeName}\n잘 맞는 사람: ${taste.matchLine}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
    } catch {}
  };
  return (
    <Split
      kicker={`01 — 프로필 · @${taste.handle}`}
      title={<>당신은<br /><em>{taste.typeName}</em></>}
      lead={taste.summary}
      aside={<button className="cq-link" onClick={onRetry}>다른 아이디로 다시</button>}
    >
      <section className="cq-invite cq-read" data-rise>
        <header><span>취향 읽기 · 게시물 {taste.postCount}개</span><span>{taste.source === 'demo' ? '예시 데이터' : '본인 확인 전'}</span></header>
        <p className="cq-hint">이런 사람과 잘 맞아요</p>
        <p className="when">{taste.matchLine}</p>
        <dl>
          <div><dt>관심사</dt><dd className="cq-demo-tags">{taste.interests.map((x) => <span key={x} className="picked">{x}</span>)}</dd></div>
          {taste.values.length > 0 && <div><dt>아끼는 것</dt><dd className="cq-demo-tags">{taste.values.map((x) => <span key={x} className="picked">{x}</span>)}</dd></div>}
          <div><dt>첫 데이트</dt><dd className="cq-demo-tags">{taste.dateStyles.map((x) => <span key={x} className="picked">{styleLabel(x)}</span>)}</dd></div>
          <div><dt>읽은 근거</dt><dd>{taste.evidence.join(' · ')}</dd></div>
        </dl>
      </section>
      {taste.source === 'demo' && (
        <p className="cq-hint" data-rise>지금은 데모라서 실제 계정 대신 예시 게시물로 만든 결과예요.</p>
      )}
      <div className="cq-submit" data-rise>
        <div className="cq-links">
          <Go onClick={onContinue}>이대로 프로필 채우기</Go>
          <Go variant="neutralWeak" onClick={share}>{shared ? '공유할 글을 복사했어요' : '결과 공유하기'}</Go>
        </div>
      </div>
    </Split>
  );
}

// ── 1. 프로필 입력 ───────────────────────────────────────────────

function Onboarding({ initial, prefilled, onDone }: { initial: Profile; prefilled?: boolean; onDone: (p: Profile) => void }) {
  const [d, setD] = useState<Profile>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Profile>) => setD((p) => ({ ...p, ...patch }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onDone(parseProfile(d));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Split
      kicker="01 — 프로필"
      title={<>에이전트에게<br />나를 알려주세요</>}
      lead={prefilled
        ? '인스타그램에서 읽은 취향을 미리 채워뒀어요. 맞지 않는 건 고치고, 나머지 칸만 채워주세요.'
        : '여기 적은 내용으로 에이전트가 상대를 고르고 이야기합니다. 잠금 표시가 있는 항목은 상대에게 전달되지 않아요.'}
      aside={<button type="button" className="cq-link" onClick={() => { setD(SAMPLE_PROFILE); setError(null); }}>예시로 채워보기</button>}
    >
      <form onSubmit={submit} noValidate>
        <Q n={1} title="이름">
          <TextField.Root variant="underline" size="large" value={d.name} onValueChange={(name) => set({ name })}>
            <TextField.Input id="cq-name" aria-label="이름 또는 닉네임" maxLength={20} placeholder="닉네임도 좋아요" />
          </TextField.Root>
        </Q>
        <Q n={2} title="생일" hint="나이와 사주 궁합 계산에만 써요. 상대에겐 나이만 보여요.">
          <div className="cq-inline">
            <Num label="태어난 해" placeholder="1995" suffix="년" value={d.birth.year} onChange={(year) => set({ birth: { ...d.birth, year } })} />
            <Num label="태어난 달" placeholder="5" suffix="월" value={d.birth.month} onChange={(month) => set({ birth: { ...d.birth, month } })} />
            <Num label="태어난 날" placeholder="25" suffix="일" value={d.birth.day} onChange={(day) => set({ birth: { ...d.birth, day } })} />
          </div>
        </Q>
        <Q n={3} title="성별">
          <Pick label="성별" options={GENDERS} value={d.gender} onChange={(gender) => set({ gender })} />
        </Q>
        <Q n={4} title="사는 곳">
          <Pick label="사는 도시" options={plain(CITIES)} value={d.city} onChange={(city) => set({ city })} />
        </Q>
        <Q n={5} title="만나고 싶은 사람" hint="성별은 여러 개 고를 수 있어요.">
          <Chips label="만나고 싶은 성별" options={GENDERS} value={d.seeking} onToggle={(g) => set({ seeking: toggle(d.seeking, g) })} />
          <div className="cq-inline two">
            <Num label="최소 나이" suffix="세부터" value={d.ageRange[0]} onChange={(n) => set({ ageRange: [n, d.ageRange[1]] })} />
            <Num label="최대 나이" suffix="세까지" value={d.ageRange[1]} onChange={(n) => set({ ageRange: [d.ageRange[0], n] })} />
          </div>
        </Q>
        <Q n={6} title="관심사" hint="2개 이상">
          <Chips label="관심사" options={plain(INTERESTS)} value={d.interests} onToggle={(x) => set({ interests: toggle(d.interests, x) })} />
        </Q>
        <Q n={7} title="중요한 가치" hint="최대 3개">
          <Chips label="중요한 가치" options={plain(VALUES)} value={d.values} onToggle={(x) => set({ values: toggle(d.values, x, 3) })} />
        </Q>
        <Q n={8} title="첫 데이트 스타일">
          <Chips label="첫 데이트 스타일" options={DATE_STYLES} value={d.dateStyles} onToggle={(x) => set({ dateStyles: toggle(d.dateStyles, x) })} />
        </Q>
        <Q n={9} title="생활">
          <dl className="cq-rows">
            <div><dt>흡연</dt><dd><Pick label="흡연" options={[{ id: 'n', label: '안 해요' }, { id: 'y', label: '해요' }]} value={d.smoker ? 'y' : 'n'} onChange={(x) => set({ smoker: x === 'y' })} /></dd></div>
            <div><dt>음주</dt><dd><Pick label="음주" options={DRINKS} value={d.drink} onChange={(drink) => set({ drink })} /></dd></div>
            <div><dt>반려동물</dt><dd><Pick label="반려동물" options={[{ id: 'y', label: '좋아해요' }, { id: 'n', label: '어려워요' }]} value={d.likesPets ? 'y' : 'n'} onChange={(x) => set({ likesPets: x === 'y' })} /></dd></div>
          </dl>
        </Q>
        <Q n={10} title="원하는 관계">
          <Pick label="원하는 관계" options={INTENTS} value={d.bond.intent} onChange={(intent) => set({ bond: { ...d.bond, intent } })} />
        </Q>
        <Q n={11} title="연락과 다툼" hint="잠금 — 답은 상대에게 전달되지 않아요. 두 사람이 맞는 정도만 계산해요.">
          <dl className="cq-rows">
            <div><dt>연락은</dt><dd><Pick label="편한 연락 빈도" options={CONTACTS} value={d.bond.contact} onChange={(contact) => set({ bond: { ...d.bond, contact } })} /></dd></div>
            <div><dt>서운할 땐</dt><dd><Pick label="서운한 일이 생기면" options={CONFLICTS} value={d.bond.conflict} onChange={(conflict) => set({ bond: { ...d.bond, conflict } })} /></dd></div>
          </dl>
        </Q>
        <Q n={12} title="가까워지는 방식" hint="잠금 — 좋고 나쁜 답은 없어요. 어떤 속도가 편한지 알기 위한 질문이에요.">
          <dl className="cq-rows wide">
            {CLOSENESS_ITEMS.map((item, i) => (
              <div key={item.text}>
                <dt>{item.text}</dt>
                <dd>
                  <Pick
                    label={item.text}
                    options={LEVELS}
                    value={String(d.bond.closeness[i])}
                    onChange={(v) => set({ bond: { ...d.bond, closeness: d.bond.closeness.map((x, k) => (k === i ? Number(v) : x)) as [Level, Level, Level, Level] } })}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </Q>
        <Q n={13} title="사랑의 언어" hint="잠금 — 마음이 오가는 방식이에요.">
          <dl className="cq-rows wide">
            <div><dt>이럴 때 사랑받는다고 느껴요</dt><dd><Pick label="사랑받는다고 느끼는 방식" options={LOVE_LANGS} value={d.bond.loveGet} onChange={(loveGet) => set({ bond: { ...d.bond, loveGet } })} /></dd></div>
            <div><dt>나는 주로 이렇게 표현해요</dt><dd><Pick label="마음을 표현하는 방식" options={LOVE_LANGS} value={d.bond.loveGive} onChange={(loveGive) => set({ bond: { ...d.bond, loveGive } })} /></dd></div>
          </dl>
        </Q>
        <Q n={14} title="내가 잘 주는 것" hint="연인에게 자연스럽게 해주는 것. 최대 2개">
          <Chips label="내가 잘 주는 것" options={NEEDS.map((n) => ({ id: n.id, label: n.give }))} value={d.bond.gives} onToggle={(x) => set({ bond: { ...d.bond, gives: toggle(d.bond.gives, x, 2) } })} />
        </Q>
        <Q n={15} title="절대 안 되는 조건" hint="잠금 — 상대에게 내용이 전달되지 않아요. 에이전트가 통과 여부만 확인합니다.">
          <Chips label="절대 안 되는 조건" options={DEALBREAKERS} value={d.dealbreakers} onToggle={(x) => set({ dealbreakers: toggle(d.dealbreakers, x) })} />
        </Q>
        <Q n={16} title="만날 수 있는 시간" hint="먼저 누른 시간을 더 선호하는 것으로 봐요. 상대에겐 겹치는 시간만 보여요.">
          <div className="cq-grid">
            <span />
            {DAYS.map((day) => <span key={day}>{DAY_LABEL[day]}</span>)}
            {PARTS.map((part) => (
              <Row key={part} label={PART_LABEL[part]}>
                {DAYS.map((day) => {
                  const id = `${day}-${part}` as SlotId;
                  const at = d.slots.indexOf(id);
                  return (
                    <button key={id} type="button" className="cq-slot" aria-pressed={at >= 0} aria-label={`${DAY_LABEL[day]}요일 ${PART_LABEL[part]}`} onClick={() => set({ slots: toggle(d.slots, id) })}>
                      {at >= 0 ? at + 1 : ''}
                    </button>
                  );
                })}
              </Row>
            ))}
          </div>
        </Q>
        <Q n={17} title="에이전트 말투" hint="상대 에이전트에게 이렇게 말해요.">
          <Pick label="에이전트 말투" options={TONES} value={d.tone} onChange={(tone) => set({ tone })} />
        </Q>

        <div className="cq-submit" data-rise>
          {error && <Callout.Root tone="critical" role="alert"><Callout.Content><Callout.Description>{error}</Callout.Description></Callout.Content></Callout.Root>}
          <Go type="submit">다음 — 깊은 대화</Go>
        </div>
      </form>
    </Split>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="rowh">{label}</span>
      {children}
    </>
  );
}

// ── 1-1. 깊은 대화 → 속마음 ──────────────────────────────────────

function Interview({ initial, error, onDone, onSkip, onEdit }: {
  initial: Record<string, string>; error: string | null;
  onDone: (answers: Record<string, string>) => void; onSkip: () => void; onEdit: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const [at, setAt] = useState(0);
  const [draft, setDraft] = useState(initial[QUESTIONS[0].id] ?? '');
  const [nudged, setNudged] = useState<string[]>([]);
  const q = QUESTIONS[at];
  const asksMore = nudged.includes(q.id);

  const move = (text: string) => {
    const next = { ...answers, [q.id]: text };
    setAnswers(next);
    if (at === QUESTIONS.length - 1) return onDone(next);
    setAt(at + 1);
    setDraft(next[QUESTIONS[at + 1].id] ?? '');
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    // 답이 짧으면 한 번만 더 물어본다
    if (text && text.length < 14 && q.more && !asksMore) return setNudged([...nudged, q.id]);
    move(text);
  };

  return (
    <Split
      kicker={`01 — 프로필 · 깊은 대화 ${at + 1}/${QUESTIONS.length}`}
      title={<>말로 고른 이상형 말고,<br /><em>이야기 속의 마음</em></>}
      lead="정답은 없어요. 떠오르는 대로 두세 문장이면 충분해요. 답은 읽고 나서 저장하지 않아요."
      aside={<p className="cq-links"><button className="cq-link" onClick={onEdit}>프로필로 돌아가기</button><button className="cq-link" onClick={onSkip}>대화 건너뛰기</button></p>}
    >
      {at > 0 && (
        <ol className="cq-script cq-past" data-rise>
          {QUESTIONS.slice(0, at).map((x) => (
            <li key={x.id} className="mine"><b>{x.ask.slice(0, 22)}…</b><span>{answers[x.id] || '건너뜀'}</span></li>
          ))}
        </ol>
      )}
      <form className="cq-ask" onSubmit={submit} key={q.id}>
        <p className="cq-kicker">에이전트의 질문</p>
        <h2>{q.ask}</h2>
        {asksMore && <p className="more" aria-live="polite">{q.more}</p>}
        <textarea id="cq-answer" aria-label="내 답" value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} maxLength={600} placeholder="편하게 적어주세요" autoFocus />
        {error && <Callout.Root tone="critical" role="alert"><Callout.Content><Callout.Description>{error}</Callout.Description></Callout.Content></Callout.Root>}
        <div className="cq-links">
          <Go type="submit">{at === QUESTIONS.length - 1 ? '이야기 읽어보기' : '다음 질문'}</Go>
          {!draft.trim() && at < QUESTIONS.length - 1 && <Go type="button" variant="ghost" onClick={() => move('')}>이 질문은 넘길게요</Go>}
        </div>
      </form>
    </Split>
  );
}

function InsightView({ insight, profile, onContinue, onRetry }: { insight: Insight; profile: Profile; onContinue: () => void; onRetry: () => void }) {
  const style = ATTACH[attachStyle(profile.bond)];
  const love = (id: string) => LOVE_LANGS.find((l) => l.id === id)!.label;
  return (
    <Split
      kicker="01 — 프로필 · 연애 심리"
      title={<>당신이 바라는 건<br /><em>{needLabel(insight.needs[0])}</em></>}
      lead={insight.gap}
      aside={<button className="cq-link" onClick={onRetry}>대화 다시 하기</button>}
    >
      <section className="cq-invite cq-read" data-rise>
        <header><span>나만 보는 결과</span><span>{insight.source === 'ai' ? 'AI가 읽음' : '낱말로 읽음'}</span></header>
        <p className="cq-hint">이런 사람과 잘 맞아요</p>
        <p className="when">{insight.needs.map((n) => NEEDS.find((x) => x.id === n)!.give.replace(/요$/, '')).join(', ')}는 사람</p>
        <dl>
          <div><dt>속마음</dt><dd className="cq-demo-tags">{insight.needs.map((n) => <span key={n} className="picked">{needLabel(n)}</span>)}</dd></div>
          {insight.evidence.length > 0 && <div><dt>읽은 근거</dt><dd>{insight.evidence.map((e) => `${needLabel(e.need)} ${e.count}번`).join(' · ')}</dd></div>}
          <div><dt>애착 유형</dt><dd><strong>{style.name}</strong> — {style.line} {style.tip}</dd></div>
          <div><dt>사랑의 언어</dt><dd>받을 때는 <strong>{love(profile.bond.loveGet)}</strong>, 줄 때는 <strong>{love(profile.bond.loveGive)}</strong></dd></div>
        </dl>
      </section>
      <p className="cq-hint" data-rise>유형은 고정된 게 아니고, 짧은 질문으로 본 대략의 모습이에요. 이 결과는 상대에게 보이지 않고, 잘 맞는 사람을 찾는 데만 써요.</p>
      <div className="cq-submit" data-rise>
        <div className="cq-links"><Go onClick={onContinue}>이 결과로 매칭하기</Go></div>
      </div>
    </Split>
  );
}

// ── 2. 브리핑 ───────────────────────────────────────────────────

function Briefing({ profile, error, onEdit, onGo }: { profile: Profile; error: string | null; onEdit: () => void; onGo: () => void }) {
  return (
    <Split
      kicker="02 — 브리핑"
      title={<>{profile.name}님의 에이전트가<br />지킬 약속</>}
      lead="보내기 전에 확인하세요. 에이전트는 아래 범위 안에서만 말합니다."
    >
      <section className="cq-q" data-rise>
        <div className="label"><h2>상대 에이전트에게 말하는 것</h2></div>
        <ul className="cq-plain field">
          <li>이름, 나이, 사는 도시</li>
          <li>관심사 — {profile.interests.join(', ')}</li>
          <li>가치관 — {profile.values.join(', ')}</li>
        </ul>
      </section>
      <section className="cq-q" data-rise>
        <div className="label"><h2>말하지 않는 것</h2></div>
        <ul className="cq-plain field">
          <li>절대 안 되는 조건 {profile.dealbreakers.length}개 — 통과 여부만 알려줘요</li>
          <li>가능한 시간 전체 — 겹치는 시간만 드러나요</li>
          <li>생년월일 — 나이만 보여요</li>
        </ul>
      </section>
      <section className="cq-q" data-rise>
        <div className="label"><h2>확정은 사람이</h2></div>
        <p className="field">에이전트는 날짜와 장소를 제안까지만 해요. 나와 상대가 모두 승인해야 데이트가 확정됩니다.</p>
      </section>
      <div className="cq-submit" data-rise>
        {error && <Callout.Root tone="critical" role="alert"><Callout.Content><Callout.Description>{error}</Callout.Description></Callout.Content></Callout.Root>}
        <div className="cq-links"><Go onClick={onGo}>에이전트 보내기</Go><Go variant="neutralWeak" onClick={onEdit}>프로필 수정</Go></div>
      </div>
    </Split>
  );
}

// ── 3. 에이전트 대화 지켜보기 ────────────────────────────────────

function Watching({ me, courtships, onDone }: { me: string; courtships: Courtship[]; onDone: () => void }) {
  const flat = courtships.flatMap((c, ci) => c.messages.map((_, mi) => ({ ci, mi })));
  const [step, setStep] = useState(0);
  const finished = step >= flat.length - 1;
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!flat.length) onDone(); // 후보가 없으면 바로 결과로
  }, [flat.length, onDone]);
  useEffect(() => {
    if (finished) return;
    const t = setTimeout(() => setStep((s) => s + 1), 1150);
    return () => clearTimeout(t);
  }, [step, finished]);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
  }, [step]);

  if (!flat.length) return null;
  const { ci, mi } = flat[Math.min(step, flat.length - 1)];
  const c = courtships[ci];
  const shown = c.messages.slice(0, mi + 1);

  return (
    <Split
      kicker={`03 — 대화 · ${ci + 1}/${courtships.length}`}
      title={<>{c.card.name}<small>{c.card.age}세 · {c.card.job} · {c.card.city}</small></>}
      lead={c.card.bio}
      aside={<Steps state={shown[shown.length - 1].state} />}
    >
      <div className="cq-live" ref={box} aria-live="polite" data-rise>
        <Script messages={shown} me={me} them={c.card.name} />
      </div>
      <div className="cq-submit">
        <Go variant={finished ? 'brandSolid' : 'neutralWeak'} onClick={onDone}>{finished ? '결과 보기' : '건너뛰고 결과 보기'}</Go>
      </div>
    </Split>
  );
}

// ── 4. 결과 목록 ────────────────────────────────────────────────

const ORDER: CourtState[] = ['confirmed', 'awaiting_partner', 'awaiting_owner', 'no_slot', 'no_fit', 'declined'];

function Results({ courtships, onOpen, onEdit, onAgain }: { courtships: Courtship[]; onOpen: (id: string) => void; onEdit: () => void; onAgain: () => void }) {
  const sorted = [...courtships].sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state));
  const live = courtships.filter((c) => c.proposal).length;
  const title = courtships.length === 0
    ? <>조건에 맞는<br />후보가 없어요</>
    : live ? <>데이트 <em>{live}건</em>을<br />잡아왔습니다</> : <>이번엔 성사된<br />제안이 없어요</>;
  const lead = courtships.length === 0
    ? '만나고 싶은 성별이나 나이 범위를 넓혀보세요.'
    : `${courtships.length}명의 에이전트와 이야기했어요. 줄을 누르면 대화와 이유를 볼 수 있어요.`;
  return (
    <Split
      kicker="04 — 결과"
      title={title}
      lead={lead}
      aside={
        <p className="cq-links">
          <button className="cq-link" onClick={onEdit}>프로필 수정</button>
          <button className="cq-link" onClick={onAgain}>다시 보내기</button>
        </p>
      }
    >
      <ul className="cq-ledger">
        {sorted.map((c, i) => (
          <li key={c.id} data-rise>
            <button className={`cq-card ${c.proposal ? 'live' : ''}`} onClick={() => onOpen(c.id)}>
              <span className="no">{String(i + 1).padStart(2, '0')}</span>
              <span className="who"><b>{c.card.name}</b><small>{c.card.age}세 · {c.card.job} · {c.card.city}</small></span>
              <span className="what">{c.proposal ? <><strong>{c.proposal.slot.label}</strong>{c.proposal.venue}</> : c.closedReason}</span>
              <StateTag state={c.state} />
              <i aria-hidden>→</i>
            </button>
          </li>
        ))}
      </ul>
    </Split>
  );
}

// ── 5. 제안 상세 · 승인 ─────────────────────────────────────────

function downloadIcs(c: Courtship) {
  const start = new Date(c.proposal!.slot.iso);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cupid//KO', 'BEGIN:VEVENT',
    `UID:cupid-${c.id}-${fmt(start)}`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(new Date(start.getTime() + 2 * 3600_000))}`,
    `SUMMARY:${c.card.name}님과 첫 데이트`, `DESCRIPTION:${c.proposal!.venue}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `cupid-${c.id}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Detail({ me, c, onBack, onOwner }: { me: string; c: Courtship; onBack: () => void; onOwner: (e: OwnerEvent) => void }) {
  const p = c.proposal;
  const stamp = useRef<HTMLSpanElement>(null);
  const confirmed = c.state === 'confirmed';
  useEffect(() => {
    if (!confirmed || !stamp.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(stamp.current, { scale: 2.6, rotate: 24, opacity: 0 }, { scale: 1, rotate: -11, opacity: 1, duration: 0.5, ease: 'power3.in' });
  }, [confirmed]);

  return (
    <Split
      kicker="04 — 결과"
      title={<>{c.card.name}<small>{c.card.age}세 · {c.card.job} · {c.card.city}</small></>}
      lead={c.card.bio}
      aside={<><Steps state={c.state} /><button className="cq-link" onClick={onBack}>← 목록으로</button></>}
    >
      {p && (
        <section className="cq-invite" aria-live="polite" data-rise>
          <header><span>{confirmed ? '첫 데이트 확정' : '첫 데이트 제안'} · {c.card.name} × {me}</span></header>
          <p className="when">{p.slot.label}</p>
          <p className="where">{p.venue} · {c.card.city}</p>
          <ul>
            {p.reasons.map((r) => <li key={r}>{r}</li>)}
            <li className="tip">{p.icebreaker}</li>
          </ul>
          <footer><span>{p.fun}</span></footer>
          {confirmed && <span className="cq-stamp" ref={stamp} aria-hidden>확정</span>}
        </section>
      )}

      {c.state === 'awaiting_owner' && p && (
        <div className="cq-submit" data-rise>
          <div className="cq-links">
            <Go onClick={() => onOwner('MY_APPROVE')}>이 데이트 승인하기</Go>
            <Go variant="neutralWeak" disabled={!p.alternatives.length} onClick={() => onOwner('RESCHEDULE')}>
              {p.alternatives.length ? `다른 시간으로 (${p.alternatives.length}개 남음)` : '다른 시간 없음'}
            </Go>
            <Go variant="ghost" onClick={() => onOwner('MY_PASS')}>이번엔 넘기기</Go>
          </div>
        </div>
      )}
      {c.state === 'awaiting_partner' && (
        <p className="cq-note" aria-live="polite">
          {c.card.name}님의 승인을 기다리는 중<span className="cq-dots3" aria-hidden><i>.</i><i>.</i><i>.</i></span>
          <small>상대 에이전트가 주인에게 물어보고 있어요. 데모에서는 가상 인물이 자동으로 답해요.</small>
        </p>
      )}
      {confirmed && p && (
        <div className="cq-submit">
          <Go onClick={() => downloadIcs(c)}>캘린더에 추가</Go>
          <p className="cq-hint">장소 예약은 아직 직접 하셔야 해요.</p>
        </div>
      )}
      {c.closedReason && (
        <section className="cq-q" data-rise>
          <div className="label"><h2>여기서 멈췄어요</h2></div>
          <p className="field">{c.closedReason}</p>
        </section>
      )}

      {p && (
        <section className="cq-q" data-rise>
          <div className="label"><h2>대화 순서 제안</h2><p>가벼운 질문에서 조금 깊은 질문으로. 답을 들으면 내 이야기도 같은 만큼 꺼내보세요.</p></div>
          <ol className="cq-ladder field">{p.ladder.map((q) => <li key={q}>{q}</li>)}</ol>
        </section>
      )}
      {p && p.hints.length > 0 && (
        <section className="cq-q" data-rise>
          <div className="label"><h2>미리 알아두면 좋은 것</h2><p>두 분의 답을 맞춰본 결과예요. 상대의 답 내용은 보여드리지 않아요.</p></div>
          <ul className="cq-plain field">{p.hints.map((h) => <li key={h}>{h}</li>)}</ul>
        </section>
      )}

      {c.score !== null && (
        <section className="cq-q" data-rise>
          <div className="label"><h2>첫 만남 적합도</h2><p className="cq-score"><em>{c.score}</em>/100</p><p>잘될지를 예언하는 점수가 아니에요. 첫 만남이 순조로울 조건이 얼마나 갖춰졌는지만 봐요.</p></div>
          <div className="cq-bars field">
            {c.breakdown.map((b) => (
              <div key={b.label}>
                <span>{b.label}</span>
                <i aria-hidden><b style={{ width: `${(b.points / b.max) * 100}%` }} /></i>
                <span>{b.points}<small>/{b.max}</small></span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="cq-q" data-rise>
        <div className="label"><h2>에이전트끼리 나눈 대화</h2><p>{c.messages.length}줄</p></div>
        <details className="field">
          <summary>대화 펼쳐보기</summary>
          <Script messages={c.messages} me={me} them={c.card.name} />
        </details>
      </section>
    </Split>
  );
}
