// 에이전트 대 에이전트 협상 엔진.
// 결정(조건 통과, 점수, 시간·장소)은 전부 이 결정적 코드가 내린다.
// LLM(voice.ts)은 말투만 다듬고, 사실은 바꾸지 못한다.

import { computeChart } from '../saju/calculator';
import { computeCompat } from '../saju/compat';
import { intentClash, readBond, talkLadder } from './psych';
import { transition, type CourtEvent, type CourtState } from './machine';
import { PERSONAS } from './personas';
import {
  DATE_STYLES, DAYS, DAY_LABEL, DEALBREAKERS, PART_HOUR, PART_LABEL,
  type A2AMessage, type AgentCard, type Courtship, type DateSlot, type Dealbreaker,
  type DateStyle, type Persona, type Profile, type SlotId, type Day, type Part,
} from './types';

export const FIT_THRESHOLD = 50;
const KST = 9 * 3600_000;

export function ageOf(birth: Profile['birth'], now: Date): number {
  const k = new Date(now.getTime() + KST);
  let age = k.getUTCFullYear() - birth.year;
  if (k.getUTCMonth() + 1 < birth.month || (k.getUTCMonth() + 1 === birth.month && k.getUTCDate() < birth.day)) age--;
  return age;
}

/** 슬롯(요일-시간대)을 "모레 이후 가장 가까운 실제 날짜"로 바꾼다 (한국 시간). */
export function slotToDate(id: SlotId, now: Date): DateSlot {
  const [day, part] = id.split('-') as [Day, Part];
  const target = (DAYS.indexOf(day) + 1) % 7; // JS: 일=0
  const k = new Date(now.getTime() + KST);
  const d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + 2));
  while (d.getUTCDay() !== target) d.setUTCDate(d.getUTCDate() + 1);
  const hour = PART_HOUR[part];
  const p2 = (n: number) => String(n).padStart(2, '0');
  const iso = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(hour)}:00:00+09:00`;
  const clock = hour === 12 ? '12시' : `${hour - 12}시`;
  const label = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${DAY_LABEL[day]}) ${PART_LABEL[part]} ${clock}`;
  return { id, iso, label };
}

function dealbreakerHits(owner: Profile, other: Profile): Dealbreaker[] {
  const facts: Record<Dealbreaker, boolean> = {
    smoker: other.smoker,
    heavy_drinker: other.drink === 'often',
    no_pets: !other.likesPets,
    other_city: other.city !== owner.city,
  };
  return owner.dealbreakers.filter((d) => facts[d]);
}

const shared = <T,>(a: T[], b: T[]) => a.filter((x) => b.includes(x));

function sajuScore(a: Profile, b: Profile): number {
  const chart = (p: Profile) =>
    computeChart({ ...p.birth, name: p.name, hour: 12, minute: 0, timeUnknown: true, tzOffset: 9 });
  return computeCompat(chart(a), chart(b)).score;
}

function scoreFit(me: Profile, them: Profile) {
  const read = readBond(
    me, them,
    shared(me.interests, them.interests).length,
    shared(me.values, them.values).length,
    shared(me.dateStyles, them.dateStyles).length,
  );
  return { score: read.parts.reduce((n, p) => n + p.points, 0), breakdown: read.parts, hints: read.hints, strengths: read.strengths };
}

// 처음 만날 때는 함께 할 거리가 있는 쪽이 대화가 쉽다 (새로운 활동을 함께하면 가까워진다는 연구).
const NOVELTY: DateStyle[] = ['activity', 'culture', 'walk', 'meal', 'coffee'];

export function toCard(p: Persona, now: Date): AgentCard {
  return { id: p.id, name: p.name, emoji: p.emoji, age: ageOf(p.birth, now), city: p.city, job: p.job, bio: p.bio, interests: p.interests };
}

/** 에이전트를 보내기 전 단계: 서로 찾는 성별·나이대가 맞는 후보만 남긴다. */
export function discover(me: Profile, now: Date, pool: Persona[] = PERSONAS): Persona[] {
  const myAge = ageOf(me.birth, now);
  return pool.filter((p) => {
    const age = ageOf(p.birth, now);
    return (
      me.seeking.includes(p.gender) && p.seeking.includes(me.gender) &&
      age >= me.ageRange[0] && age <= me.ageRange[1] &&
      myAge >= p.ageRange[0] && myAge <= p.ageRange[1]
    );
  });
}

const HELLO: Record<Profile['tone'], (me: string, them: string) => string> = {
  polite: (me, them) => `안녕하세요, ${me}님의 에이전트입니다. ${them}님 프로필을 보고 인사드려요.`,
  witty: (me, them) => `똑똑, ${me}님 담당 큐피트예요. ${them}님 프로필이 눈에 띄어서 날아왔어요.`,
  direct: (me, them) => `${me}님의 에이전트입니다. ${them}님과 잘 맞을지 바로 확인해보고 싶어요.`,
};

export function runCourtship(me: Profile, them: Persona, now: Date): Courtship {
  let state: CourtState = 'discovered';
  const messages: A2AMessage[] = [];
  const say = (from: A2AMessage['from'], kind: A2AMessage['kind'], text: string, event?: CourtEvent) => {
    if (event) state = transition(state, event);
    messages.push({ from, kind, text, state });
  };
  const done = (extra: Partial<Courtship> = {}): Courtship => ({
    id: them.id, card: toCard(them, now), state, score: null, breakdown: [],
    messages, proposal: null, closedReason: null, ...extra,
  });

  // 1) 인사 + 공개 카드 교환
  say('mine', 'hello', HELLO[me.tone](me.name, them.name));
  say('theirs', 'hello', `반가워요, ${them.name}님의 에이전트예요. ${them.name}님은 ${them.city}에 사는 ${them.job}이고, ${them.interests.slice(0, 3).join(' · ')}을(를) 좋아해요.`, 'HELLO');

  // 2) 비공개 조건 — 내용은 넘기지 않고 통과 여부만 교환
  say('mine', 'screen', '먼저 서로의 비공개 조건을 확인할게요. 내용은 주고받지 않고, 통과 여부만 알려주는 걸로요.');
  const myHits = dealbreakerHits(me, them);
  const theirHits = dealbreakerHits(them, me);
  if (myHits.length) {
    say('mine', 'bow_out', '확인해보니 저희 쪽 조건과 맞지 않네요. 여기서 정중히 멈출게요. 좋은 인연 만나시길 바라요.', 'SCREEN_FAIL');
    const labels = myHits.map((h) => DEALBREAKERS.find((d) => d.id === h)!.label).join(', ');
    return done({ closedReason: `내 비공개 조건에 해당: ${labels}` });
  }
  if (theirHits.length) {
    say('theirs', 'bow_out', '죄송해요, 저희 쪽 조건과 맞지 않아서 여기까지 할게요. 좋은 분 만나시길 바라요.', 'SCREEN_FAIL');
    return done({ closedReason: '상대의 비공개 조건과 맞지 않음 (내용은 상대만 알아요)' });
  }
  say('theirs', 'screen', '양쪽 모두 통과예요. 이제 취향 이야기를 해볼까요?', 'SCREEN_PASS');

  // 3) 관계 방향 — 원하는 관계가 정반대면 여기서 멈춘다
  say('mine', 'explore', '이번엔 어떤 관계를 원하는지, 연락과 대화 방식은 어떤지 맞춰볼게요. 답 내용은 주고받지 않고 맞는 정도만요.');
  if (intentClash(me.bond, them.bond)) {
    say('theirs', 'bow_out', '원하는 관계의 모습이 서로 달라요. 두 분 다 실망하지 않도록 여기서 멈출게요.', 'FIT_LOW');
    return done({ closedReason: '원하는 관계의 모습이 서로 달라요 (진지한 연애 ↔ 가볍게)' });
  }
  const { score, breakdown, hints, strengths } = scoreFit(me, them);
  const si = shared(me.interests, them.interests);
  const sv = shared(me.values, them.values);
  say('mine', 'explore', `${me.name}님은 ${me.interests.slice(0, 3).join(' · ')}을(를) 좋아하고, ${me.values.join(' · ')}을(를) 중요하게 생각해요.`);
  say('theirs', 'explore', si.length || sv.length
    ? `오, ${[...si, ...sv].join(' · ')}이(가) 겹치네요! ${them.name}님도 그 얘기라면 한참 할 분이에요.`
    : `겹치는 부분은 많지 않네요. ${them.name}님은 ${them.values.join(' · ')} 쪽이에요.`);
  if (score < FIT_THRESHOLD) {
    say('mine', 'bow_out', `첫 만남 적합도가 ${score}점이에요. 두 분 시간을 아끼는 쪽이 좋겠어요. 이야기 나눠주셔서 고마워요.`, 'FIT_LOW');
    return done({ score, breakdown, closedReason: `첫 만남 적합도 ${score}점 (기준 ${FIT_THRESHOLD}점 미만)` });
  }
  say('mine', 'explore', `첫 만남 적합도 ${score}점이에요. 만나볼 조건은 갖춰졌어요. 날짜를 잡아볼까요?`, 'FIT_OK');

  // 4) 일정 조율 — 한 번에 하나씩 제안하고, 엇갈리면 겹치는 시간만 맞춰본다
  const L = (id: SlotId) => slotToDate(id, now).label;
  const overlap = shared(me.slots, them.slots)
    .map((id) => slotToDate(id, now))
    .sort((a, b) => a.iso.localeCompare(b.iso));
  let agreed: SlotId | null = null;
  say('mine', 'propose', `${L(me.slots[0])} 어떠세요?`, 'PROPOSE');
  if (them.slots.includes(me.slots[0])) agreed = me.slots[0];
  else {
    say('theirs', 'counter', `그때는 어려워요. ${L(them.slots[0])}는 어떠세요?`, 'COUNTER');
    if (me.slots.includes(them.slots[0])) agreed = them.slots[0];
    else {
      say('mine', 'propose', '그 시간은 저희가 안 되네요. 가능한 시간대를 서로 대조해서 겹치는 것만 찾아볼게요.', 'PROPOSE');
      if (overlap.length) {
        agreed = overlap[0].id;
        say('theirs', 'counter', `겹치는 시간이 있어요 — ${overlap[0].label}.`, 'COUNTER');
      }
    }
  }
  if (!agreed) {
    say('theirs', 'bow_out', '아쉽지만 이번 주는 겹치는 시간이 없네요. 일정이 바뀌면 다시 찾아주세요.', 'NO_OVERLAP');
    return done({ score, breakdown, closedReason: '조건은 잘 맞지만 겹치는 시간이 없음 — 가능한 시간을 늘리면 다시 시도할 수 있어요' });
  }

  const slot = slotToDate(agreed, now);
  const both = shared(me.dateStyles, them.dateStyles);
  const style = NOVELTY.find((s) => both.includes(s)) ?? 'coffee';
  const venue = DATE_STYLES.find((d) => d.id === style)!.venue;
  say('theirs', 'accept', `좋아요, ${slot.label}에 ${venue}로 하죠.`);
  say('mine', 'accept', '그럼 각자 주인께 승인을 받을게요. 두 분 모두 승인하기 전까지는 확정이 아니에요.', 'AGREE');

  const reasons = [
    si.length ? `둘 다 ${si.join(' · ')}을(를) 좋아해요` : null,
    sv.length ? `${sv.join(' · ')}을(를) 똑같이 중요하게 생각해요` : null,
    ...strengths,
    `서로의 비공개 조건을 모두 통과했어요`,
  ].filter((r): r is string => !!r).slice(0, 5);
  const icebreaker = si.length
    ? `"${si[0]}" 이야기로 시작해보세요. ${them.name}님도 좋아하는 주제예요.`
    : `${them.name}님의 일(${them.job}) 이야기를 물어보세요.`;

  return done({
    score, breakdown,
    proposal: { slot, alternatives: overlap.filter((o) => o.id !== agreed), venue, icebreaker, reasons, ladder: talkLadder(si[0] ?? null, them.name), hints,
      fun: `재미로 보는 사주 궁합은 ${sajuScore(me, them)}점이에요. 근거가 없어 적합도에는 넣지 않았어요.` },
  });
}

export function runAll(me: Profile, now: Date): Courtship[] {
  return discover(me, now).map((p) => runCourtship(me, p, now));
}
