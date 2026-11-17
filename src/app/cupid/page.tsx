'use client';

// 큐피트 — 내 에이전트가 상대 에이전트와 대화해서 첫 데이트를 잡아온다.
// 화면 전환은 SCREEN_FLOW, 각 후보와의 진행은 COURT_FLOW 표로만 움직인다.

import { useEffect, useReducer, useRef, useState } from 'react';
import {
  Accordion, Alert, Badge, Button, Card, Glass, NumberField, Progress, SegmentedControl, Select, Spinner,
  TextField, ToggleButton,
} from 'open-glass-ui';
import { applyOwnerEvent, type OwnerEvent } from '@/lib/cupid/owner';
import { COURT_LABEL, COURT_STEPS, SCREEN_FLOW, canFire, type CourtState, type Screen } from '@/lib/cupid/machine';
import { SAMPLE_PROFILE } from '@/lib/cupid/sample';
import { parseProfile } from '@/lib/cupid/validate';
import {
  CITIES, DATE_STYLES, DAYS, DAY_LABEL, DEALBREAKERS, DRINKS, GENDERS, INTERESTS, PARTS, PART_LABEL, TONES, VALUES,
  type A2AMessage, type Courtship, type Profile, type SlotId,
} from '@/lib/cupid/types';

const STORE_KEY = 'cupid.profile.v1';
const EMPTY: Profile = {
  name: '', birth: { year: 0, month: 0, day: 0 }, gender: 'female', seeking: [], ageRange: [25, 35], city: '서울',
  interests: [], values: [], smoker: false, drink: 'social', likesPets: true, dealbreakers: [], dateStyles: [], slots: [], tone: 'witty',
};

interface Ctx {
  screen: Screen;
  profile: Profile | null;
  courtships: Courtship[];
  voiced: boolean;
  openId: string | null;
  error: string | null;
}
type Action =
  | { type: 'PROFILE_SAVED'; profile: Profile }
  | { type: 'EDIT' | 'DISPATCH' | 'WATCHED' | 'BACK' }
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
  if (a.type === 'FAILED') next.error = a.error;
  if (a.type === 'OPEN') next.openId = a.id;
  return next;
}

export default function CupidPage() {
  const [ctx, send] = useReducer(reducer, {
    screen: 'onboarding', profile: null, courtships: [], voiced: false, openId: null, error: null,
  });
  const [saved, setSaved] = useState<Profile | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setSaved(parseProfile(JSON.parse(raw)));
    } catch {}
  }, []);

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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [ctx.screen]);

  const open = ctx.courtships.find((c) => c.id === ctx.openId);

  return (
    <main className="cq-wrap">
      <header className="cq-top">
        <span className="cq-logo">💘 큐피트</span>
        <Badge>데모 · 상대는 가상 인물</Badge>
      </header>

      {ctx.screen === 'onboarding' && (
        <Onboarding
          key={saved ? 'saved' : 'empty'}
          initial={ctx.profile ?? saved ?? EMPTY}
          onDone={(profile) => {
            try {
              localStorage.setItem(STORE_KEY, JSON.stringify(profile));
            } catch {}
            send({ type: 'PROFILE_SAVED', profile });
          }}
        />
      )}
      {ctx.screen === 'briefing' && ctx.profile && (
        <Briefing profile={ctx.profile} error={ctx.error} onEdit={() => send({ type: 'EDIT' })} onGo={() => send({ type: 'DISPATCH' })} />
      )}
      {ctx.screen === 'dispatching' && (
        <Glass as="section" className="cq-panel cq-center" aria-live="polite">
          <Spinner label="에이전트를 보내는 중" />
          <h2>에이전트가 날아가는 중…</h2>
          <p className="cq-muted">조건이 맞는 상대의 에이전트를 찾고 있어요.</p>
        </Glass>
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
  );
}

// ── 공용 조각 ────────────────────────────────────────────────────

function Chips<T extends string>({ options, value, onToggle }: {
  options: { id: T; label: string }[];
  value: T[];
  onToggle: (id: T) => void;
}) {
  return (
    <div className="cq-chips">
      {options.map((o) => (
        <ToggleButton key={o.id} pressed={value.includes(o.id)} onPressedChange={() => onToggle(o.id)}>
          {o.label}
        </ToggleButton>
      ))}
    </div>
  );
}

function Pick<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="cq-wide">
      <SegmentedControl aria-label={label} items={options.map((o) => ({ value: o.id, label: o.label }))} value={value} onValueChange={onChange} />
    </div>
  );
}

const plain = (xs: string[]) => xs.map((x) => ({ id: x, label: x }));
const toggle = <T,>(xs: T[], x: T, max = 99): T[] =>
  xs.includes(x) ? xs.filter((y) => y !== x) : xs.length >= max ? xs : [...xs, x];

const STATE_TONE: Partial<Record<CourtState, 'positive' | 'accent' | 'warning'>> = {
  confirmed: 'positive', awaiting_owner: 'accent', no_slot: 'warning',
};
function StateChip({ state }: { state: CourtState }) {
  return <Badge tone={STATE_TONE[state] ?? 'neutral'}>{COURT_LABEL[state]}</Badge>;
}

function Steps({ state }: { state: CourtState }) {
  const at = COURT_STEPS.findIndex((s) => s.state === state);
  if (at < 0) return <div><StateChip state={state} /></div>;
  return <Progress label={`${at + 1}/${COURT_STEPS.length} · ${COURT_STEPS[at].label}`} value={at + 1} max={COURT_STEPS.length} />;
}

function Person({ c, right }: { c: Courtship; right?: React.ReactNode }) {
  return (
    <div className="cq-person">
      <div className="cq-avatar" aria-hidden>{c.card.emoji}</div>
      <div className="who">
        <b>{c.card.name}</b> <span className="cq-muted">{c.card.age}세</span>
        <small>{c.card.job} · {c.card.city}</small>
      </div>
      {right}
    </div>
  );
}

function Bubble({ m, me, them }: { m: A2AMessage; me: string; them: string }) {
  return (
    <div className={`cq-msg ${m.from}`}>
      <small>{m.from === 'mine' ? `${me}의 에이전트` : `${them}의 에이전트`}</small>
      {m.text}
    </div>
  );
}

// ── 1. 프로필 입력 ───────────────────────────────────────────────

function Onboarding({ initial, onDone }: { initial: Profile; onDone: (p: Profile) => void }) {
  const [d, setD] = useState<Profile>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Profile>) => setD((p) => ({ ...p, ...patch }));
  const num = (v: string) => Number(v.replace(/\D/g, '')) || 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onDone(parseProfile(d));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form className="cq-stack" onSubmit={submit} noValidate>
      <Glass as="section" className="cq-panel cq-hero">
        <h1>첫 데이트,<br /><em>내 에이전트가 잡아올게요.</em></h1>
        <p>나를 알려주면 에이전트가 상대의 에이전트와 대화해서 잘 맞는 사람을 찾고, 시간과 장소까지 맞춰옵니다. 확정은 내가 승인할 때만.</p>
        <div>
          <Button onClick={() => { setD(SAMPLE_PROFILE); setError(null); }}>✨ 예시로 채우기</Button>
        </div>
      </Glass>

      <Glass as="section" className="cq-panel">
        <h2>나</h2>
        <TextField id="cq-name" label="이름 (닉네임)" value={d.name} maxLength={20} placeholder="예: 하늘" onChange={(e) => set({ name: e.target.value })} />
        <div className="cq-row c3">
          <TextField label="태어난 해" inputMode="numeric" placeholder="1995" value={d.birth.year || ''} onChange={(e) => set({ birth: { ...d.birth, year: num(e.target.value) } })} />
          <TextField label="월" inputMode="numeric" placeholder="5" value={d.birth.month || ''} onChange={(e) => set({ birth: { ...d.birth, month: num(e.target.value) } })} />
          <TextField label="일" inputMode="numeric" placeholder="25" value={d.birth.day || ''} onChange={(e) => set({ birth: { ...d.birth, day: num(e.target.value) } })} />
        </div>
        <p className="cq-muted">생일은 나이와 사주 궁합 계산에만 써요. 상대에겐 나이만 보여요.</p>
        <span className="cq-label">성별</span>
        <Pick label="성별" options={GENDERS} value={d.gender} onChange={(gender) => set({ gender })} />
        <Select label="사는 도시" options={CITIES.map((c) => ({ value: c, label: c }))} value={d.city} onChange={(e) => set({ city: e.currentTarget.value })} />
      </Glass>

      <Glass as="section" className="cq-panel">
        <h2>만나고 싶은 사람</h2>
        <span className="cq-label">성별 (여러 개 가능)</span>
        <Chips options={GENDERS} value={d.seeking} onToggle={(g) => set({ seeking: toggle(d.seeking, g) })} />
        <div className="cq-row c2">
          <NumberField label="최소 나이" min={19} max={80} value={d.ageRange[0]} onValueChange={(n) => set({ ageRange: [n, d.ageRange[1]] })} decrementLabel="최소 나이 줄이기" incrementLabel="최소 나이 늘리기" />
          <NumberField label="최대 나이" min={19} max={80} value={d.ageRange[1]} onValueChange={(n) => set({ ageRange: [d.ageRange[0], n] })} decrementLabel="최대 나이 줄이기" incrementLabel="최대 나이 늘리기" />
        </div>
      </Glass>

      <Glass as="section" className="cq-panel">
        <h2>취향</h2>
        <span className="cq-label">관심사 (2개 이상)</span>
        <Chips options={plain(INTERESTS)} value={d.interests} onToggle={(x) => set({ interests: toggle(d.interests, x) })} />
        <span className="cq-label">중요한 가치 (최대 3개)</span>
        <Chips options={plain(VALUES)} value={d.values} onToggle={(x) => set({ values: toggle(d.values, x, 3) })} />
        <span className="cq-label">첫 데이트 스타일</span>
        <Chips options={DATE_STYLES} value={d.dateStyles} onToggle={(x) => set({ dateStyles: toggle(d.dateStyles, x) })} />
      </Glass>

      <Glass as="section" className="cq-panel">
        <h2>생활</h2>
        <span className="cq-label">흡연</span>
        <Pick label="흡연" options={[{ id: 'n', label: '비흡연' }, { id: 'y', label: '흡연' }]} value={d.smoker ? 'y' : 'n'} onChange={(x) => set({ smoker: x === 'y' })} />
        <span className="cq-label">음주</span>
        <Pick label="음주" options={DRINKS} value={d.drink} onChange={(drink) => set({ drink })} />
        <span className="cq-label">반려동물</span>
        <Pick label="반려동물" options={[{ id: 'y', label: '좋아해요' }, { id: 'n', label: '어려워요' }]} value={d.likesPets ? 'y' : 'n'} onChange={(x) => set({ likesPets: x === 'y' })} />
      </Glass>

      <Glass as="section" className="cq-panel">
        <h2>🔒 절대 안 되는 조건</h2>
        <p className="cq-muted">상대에게 내용은 전달되지 않아요. 에이전트가 통과 여부만 확인합니다.</p>
        <Chips options={DEALBREAKERS} value={d.dealbreakers} onToggle={(x) => set({ dealbreakers: toggle(d.dealbreakers, x) })} />
      </Glass>

      <Glass as="section" className="cq-panel">
        <h2>만날 수 있는 시간</h2>
        <p className="cq-muted">먼저 누른 시간을 더 선호하는 것으로 봐요. 상대에겐 겹치는 시간만 보여요.</p>
        <div className="cq-grid">
          <span />
          {DAYS.map((day) => <span key={day}>{DAY_LABEL[day]}</span>)}
          {PARTS.map((part) => (
            <Row key={part} label={PART_LABEL[part]}>
              {DAYS.map((day) => {
                const id = `${day}-${part}` as SlotId;
                const at = d.slots.indexOf(id);
                return (
                  <ToggleButton key={id} pressed={at >= 0} aria-label={`${DAY_LABEL[day]}요일 ${PART_LABEL[part]}`} onPressedChange={() => set({ slots: toggle(d.slots, id) })}>
                    {at >= 0 ? at + 1 : ' '}
                  </ToggleButton>
                );
              })}
            </Row>
          ))}
        </div>
      </Glass>

      <Glass as="section" className="cq-panel">
        <h2>내 에이전트 말투</h2>
        <Pick label="에이전트 말투" options={TONES} value={d.tone} onChange={(tone) => set({ tone })} />
      </Glass>

      {error && <Alert tone="danger" title={error} />}
      <div className="cq-actions">
        <Button type="submit" variant="primary" size="large">다음 — 에이전트 브리핑</Button>
      </div>
    </form>
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

// ── 2. 브리핑 ───────────────────────────────────────────────────

function Briefing({ profile, error, onEdit, onGo }: { profile: Profile; error: string | null; onEdit: () => void; onGo: () => void }) {
  return (
    <div className="cq-stack">
      <Glass as="section" className="cq-panel cq-hero">
        <h1>{profile.name}님의 에이전트,<br /><em>출발 준비 완료 🏹</em></h1>
        <p>보내기 전에, 에이전트가 지킬 약속을 확인하세요.</p>
      </Glass>
      <Glass as="section" className="cq-panel">
        <h2>상대 에이전트에게 말하는 것</h2>
        <ul className="cq-list">
          <li><span>💬</span><span>이름, 나이, 도시</span></li>
          <li><span>💬</span><span>관심사: {profile.interests.join(' · ')}</span></li>
          <li><span>💬</span><span>가치관: {profile.values.join(' · ')}</span></li>
        </ul>
      </Glass>
      <Glass as="section" className="cq-panel">
        <h2>말하지 않는 것</h2>
        <ul className="cq-list">
          <li><span>🔒</span><span>절대 안 되는 조건 {profile.dealbreakers.length}개 — 통과 여부만 알려줘요</span></li>
          <li><span>🔒</span><span>가능한 시간 전체 — 겹치는 시간만 드러나요</span></li>
          <li><span>🔒</span><span>생년월일 — 나이만 보여요</span></li>
        </ul>
      </Glass>
      <Glass as="section" className="cq-panel">
        <h2>확정은 사람이</h2>
        <p className="cq-muted">에이전트는 날짜와 장소를 “제안”까지만 해요. 나와 상대가 모두 승인해야 데이트가 확정됩니다.</p>
      </Glass>
      {error && <Alert tone="danger" title={error} />}
      <div className="cq-actions">
        <Button variant="primary" size="large" onClick={onGo}>에이전트 보내기 🏹</Button>
        <Button size="large" onClick={onEdit}>프로필 수정</Button>
      </div>
    </div>
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
    const t = setTimeout(() => setStep((s) => s + 1), 1100);
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
    <div className="cq-stack">
      <div className="cq-dots" aria-label={`후보 ${courtships.length}명 중 ${ci + 1}번째`}>
        {courtships.map((x, i) => (
          <span key={x.id} className={i === ci ? 'on' : i < ci ? 'past' : ''}>{x.card.emoji}</span>
        ))}
      </div>
      <Glass as="section" className="cq-panel">
        <Person c={c} />
        <p className="cq-muted">{c.card.bio}</p>
        <Steps state={shown[shown.length - 1].state} />
      </Glass>
      <Glass as="section" className="cq-panel">
        <div className="cq-chat" ref={box} aria-live="polite">
          {shown.map((m, i) => <Bubble key={`${c.id}-${i}`} m={m} me={me} them={c.card.name} />)}
        </div>
      </Glass>
      <div className="cq-actions">
        <Button variant={finished ? 'primary' : 'secondary'} size="large" onClick={onDone}>
          {finished ? '결과 보기' : '건너뛰고 결과 보기'}
        </Button>
      </div>
    </div>
  );
}

// ── 4. 결과 목록 ────────────────────────────────────────────────

const ORDER: CourtState[] = ['confirmed', 'awaiting_partner', 'awaiting_owner', 'no_slot', 'no_fit', 'declined'];

function Results({ courtships, onOpen, onEdit, onAgain }: { courtships: Courtship[]; onOpen: (id: string) => void; onEdit: () => void; onAgain: () => void }) {
  const sorted = [...courtships].sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state));
  const live = courtships.filter((c) => c.proposal).length;
  return (
    <div className="cq-stack">
      <Glass as="section" className="cq-panel cq-hero">
        {courtships.length === 0 ? (
          <>
            <h1>조건에 맞는 <em>후보가 없어요</em></h1>
            <p>만나고 싶은 성별이나 나이 범위를 넓혀보세요.</p>
          </>
        ) : live ? (
          <>
            <h1>에이전트가 <em>데이트 {live}건</em>을<br />잡아왔어요</h1>
            <p>{courtships.length}명의 에이전트와 이야기했어요. 눌러서 확인하고 승인하세요.</p>
          </>
        ) : (
          <>
            <h1>이번엔 <em>성사된 제안이 없어요</em></h1>
            <p>{courtships.length}명의 에이전트와 이야기했어요. 이유를 눌러서 확인해보세요.</p>
          </>
        )}
      </Glass>
      {sorted.map((c) => (
        <Card
          key={c.id}
          className="cq-card"
          onPress={() => onOpen(c.id)}
          footer={c.proposal ? <><b>{c.proposal.slot.label}</b> · {c.proposal.venue}</> : c.closedReason}
        >
          <Person c={c} right={<StateChip state={c.state} />} />
        </Card>
      ))}
      <div className="cq-actions c2">
        <Button size="large" onClick={onEdit}>프로필 수정</Button>
        <Button size="large" onClick={onAgain}>다시 보내기</Button>
      </div>
    </div>
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
    `SUMMARY:${c.card.name}님과 첫 데이트 💘`, `DESCRIPTION:${c.proposal!.venue}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `cupid-${c.id}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Detail({ me, c, onBack, onOwner }: { me: string; c: Courtship; onBack: () => void; onOwner: (e: OwnerEvent) => void }) {
  const p = c.proposal;
  return (
    <div className="cq-stack">
      <div><Button variant="quiet" onClick={onBack}>← 목록</Button></div>
      <Glass as="section" className="cq-panel">
        <Person c={c} />
        <p className="cq-muted">{c.card.bio}</p>
        <Steps state={c.state} />
      </Glass>

      {p && (
        <Glass as="section" className="cq-panel cq-ticket" aria-live="polite">
          <div><Badge tone={c.state === 'confirmed' ? 'positive' : 'accent'}>{c.state === 'confirmed' ? '🎉 첫 데이트 확정' : '에이전트가 잡아온 첫 데이트'}</Badge></div>
          <p className="when">{p.slot.label}</p>
          <p className="cq-muted">{p.venue} · {c.card.city}</p>
          <hr />
          <ul className="cq-list">
            {p.reasons.map((r) => <li key={r}><span>💗</span><span>{r}</span></li>)}
            <li><span>💡</span><span>{p.icebreaker}</span></li>
          </ul>
        </Glass>
      )}

      {c.state === 'awaiting_owner' && p && (
        <div className="cq-actions">
          <Button variant="primary" size="large" onClick={() => onOwner('MY_APPROVE')}>이 데이트 승인하기</Button>
          <div className="cq-actions c2">
            <Button size="large" disabled={!p.alternatives.length} onClick={() => onOwner('RESCHEDULE')}>
              {p.alternatives.length ? `다른 시간 (${p.alternatives.length}개)` : '다른 시간 없음'}
            </Button>
            <Button size="large" onClick={() => onOwner('MY_PASS')}>이번엔 패스</Button>
          </div>
        </div>
      )}
      {c.state === 'awaiting_partner' && (
        <Glass as="section" className="cq-panel cq-center" aria-live="polite">
          <Spinner label="기다리는 중" />
          <h2>{c.card.name}님의 승인을 기다리는 중</h2>
          <p className="cq-muted">상대 에이전트가 주인에게 물어보고 있어요. (데모에서는 가상 인물이 자동으로 답해요)</p>
        </Glass>
      )}
      {c.state === 'confirmed' && p && (
        <div className="cq-actions">
          <Button variant="primary" size="large" onClick={() => downloadIcs(c)}>📅 캘린더에 추가</Button>
          <p className="cq-muted cq-center">장소 예약은 아직 직접 하셔야 해요.</p>
        </div>
      )}
      {c.closedReason && (
        <Glass as="section" className="cq-panel">
          <h2>여기서 멈췄어요</h2>
          <p className="cq-muted">{c.closedReason}</p>
        </Glass>
      )}

      {c.score !== null && (
        <Glass as="section" className="cq-panel">
          <h2>케미 점수 {c.score}점</h2>
          {c.breakdown.map((b) => (
            <Progress key={b.label} label={`${b.label} ${b.points}/${b.max}`} value={b.points} max={b.max} />
          ))}
        </Glass>
      )}

      <Glass as="section" className="cq-panel">
        <Accordion
          defaultOpenIds={[]}
          items={[{
            id: 'talk',
            title: `에이전트끼리 나눈 대화 (${c.messages.length})`,
            content: (
              <div className="cq-chat static">
                {c.messages.map((m, i) => <Bubble key={i} m={m} me={me} them={c.card.name} />)}
              </div>
            ),
          }]}
        />
      </Glass>
    </div>
  );
}
