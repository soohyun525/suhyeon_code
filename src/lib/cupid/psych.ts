// 관계 심리 분석 요소. 근거와 원칙은 docs/CUPID_PSYCHOLOGY.md.
//
// 원칙 요약
//  1. 겸손: 만나기 전 정보로 "끌림"은 예측되지 않는다. 점수는 궁합 예언이 아니라
//     "첫 만남이 순조로울 조건이 얼마나 갖춰졌나"만 말한다.
//  2. 사람이 아니라 조합에 점수를 매긴다. 불안하거나 거리를 두는 성향 자체로 감점하지 않는다.
//  3. 닮음보다 어긋남을 본다. 관계 목표·연락 기대·갈등 방식처럼 어긋나면 힘든 것을 맞춘다.
//  4. 사주·MBTI는 점수에 쓰지 않는다. 사랑의 언어는 근거가 약하지만 제품 결정으로 작은 배점(10)만 준다.
//  5. 답은 비공개. 애착 유형 이름은 본인에게만 보여주고, 상대에게는 "맞는 정도"와 조합 수준의 조언만 간다.
//  6. 속마음: 말로 고른 이상형보다 이야기에서 반복되는 바람(needs)을 본다. 내 바람 ↔ 상대가 잘 주는 것.

import type { Profile, ScorePart } from './types';

export type Intent = 'serious' | 'open' | 'casual';
export type Contact = 'often' | 'daily' | 'light';
export type Conflict = 'talk' | 'cool' | 'avoid';
/** 0 아니다 · 1 가끔 · 2 자주 */
export type Level = 0 | 1 | 2;

export const INTENTS: { id: Intent; label: string }[] = [
  { id: 'serious', label: '진지한 연애' },
  { id: 'open', label: '만나보고 정할래요' },
  { id: 'casual', label: '가볍게' },
];
export const CONTACTS: { id: Contact; label: string }[] = [
  { id: 'often', label: '틈날 때마다' },
  { id: 'daily', label: '하루 한두 번' },
  { id: 'light', label: '용건 있을 때' },
];
export const CONFLICTS: { id: Conflict; label: string }[] = [
  { id: 'talk', label: '바로 이야기해요' },
  { id: 'cool', label: '시간을 두고 이야기해요' },
  { id: 'avoid', label: '웬만하면 넘어가요' },
];
export const LEVELS: { id: string; label: string }[] = [
  { id: '0', label: '아니에요' },
  { id: '1', label: '가끔' },
  { id: '2', label: '자주' },
];
/** 가까워지는 방식 4문항. 앞 둘은 "마음 쓰임"(불안), 뒤 둘은 "거리 두기"(회피) 차원. */
export const CLOSENESS_ITEMS: { key: 'anx' | 'avo'; text: string }[] = [
  { key: 'anx', text: '답장이 늦으면 마음이 쓰여요' },
  { key: 'anx', text: '상대 마음이 식을까 걱정될 때가 있어요' },
  { key: 'avo', text: '힘든 일은 혼자 정리하는 편이에요' },
  { key: 'avo', text: '너무 가까워지면 조금 답답해요' },
];

export type LoveLang = 'words' | 'time' | 'gifts' | 'acts' | 'touch';
export const LOVE_LANGS: { id: LoveLang; label: string }[] = [
  { id: 'words', label: '인정하는 말' },
  { id: 'time', label: '함께하는 시간' },
  { id: 'acts', label: '챙겨주는 행동' },
  { id: 'gifts', label: '선물' },
  { id: 'touch', label: '스킨십' },
];

/** 연애에서 바라는 것 / 잘 주는 것. 깊은 대화에서 읽어내거나 직접 고른다. */
export type Need = 'steady' | 'space' | 'praise' | 'fun' | 'depth' | 'support';
export const NEEDS: { id: Need; label: string; give: string }[] = [
  { id: 'steady', label: '한결같은 안정감', give: '한결같이 곁에 있어요' },
  { id: 'space', label: '나만의 공간', give: '각자의 시간을 존중해요' },
  { id: 'praise', label: '인정과 표현', give: '고맙다, 좋다는 말을 자주 해요' },
  { id: 'fun', label: '재미와 설렘', give: '같이 있으면 웃게 해줘요' },
  { id: 'depth', label: '깊은 대화', give: '끝까지 들어줘요' },
  { id: 'support', label: '든든한 지지', give: '힘들 때 먼저 챙겨요' },
];
export const needLabel = (n: Need) => NEEDS.find((x) => x.id === n)!.label;

export type AttachStyle = 'secure' | 'anxious' | 'avoidant' | 'fearful';
export const ATTACH: Record<AttachStyle, { name: string; line: string; tip: string }> = {
  secure: { name: '안정형', line: '가까워지는 것도, 각자 있는 것도 편한 편이에요.', tip: '지금처럼 솔직하게 표현하면 돼요.' },
  anxious: { name: '불안형', line: '마음을 많이 쓰고, 상대의 반응에 민감한 편이에요.', tip: '불안할 땐 추측하기보다 "지금 이런 마음이야"라고 말해보세요.' },
  avoidant: { name: '회피형', line: '혼자 정리할 시간이 있어야 편한 편이에요.', tip: '거리가 필요할 땐 사라지기보다 "조금 있다 이야기하자"고 알려주세요.' },
  fearful: { name: '혼란형', line: '가까워지고 싶으면서도 가까워지면 조심스러워지는 편이에요.', tip: '속도를 천천히 가져가도 된다고 먼저 말해두면 편해요.' },
};

export interface Bond {
  intent: Intent;
  contact: Contact;
  conflict: Conflict;
  closeness: [Level, Level, Level, Level];
  loveGive: LoveLang; // 내가 마음을 표현하는 방식
  loveGet: LoveLang; // 받을 때 사랑받는다고 느끼는 방식
  gives: Need[]; // 내가 연인에게 잘 주는 것 (직접 고름, 최대 2)
  needs: Need[]; // 내가 바라는 것 (깊은 대화에서 읽어냄, 건너뛰면 비어 있음)
}
export const EMPTY_BOND: Bond = { intent: 'open', contact: 'daily', conflict: 'cool', closeness: [1, 0, 1, 0], loveGive: 'time', loveGet: 'time', gives: [], needs: [] };

const anx = (b: Bond) => b.closeness[0] + b.closeness[1]; // 0..4
const avo = (b: Bond) => b.closeness[2] + b.closeness[3]; // 0..4
const HIGH = 3;

/** 4문항으로 보는 대략의 애착 유형. 본인에게만 보여준다. */
export function attachStyle(b: Bond): AttachStyle {
  const x = anx(b) >= HIGH, v = avo(b) >= HIGH;
  return x && v ? 'fearful' : x ? 'anxious' : v ? 'avoidant' : 'secure';
}

/** 원하는 관계가 정반대면 점수를 내기 전에 멈춘다. */
export function intentClash(a: Bond, b: Bond): boolean {
  return (a.intent === 'serious' && b.intent === 'casual') || (a.intent === 'casual' && b.intent === 'serious');
}

const CONTACT_ORDER: Contact[] = ['often', 'daily', 'light'];
const CONFLICT_FIT: Record<string, number> = {
  'talk|talk': 10, 'cool|talk': 8, 'cool|cool': 8, 'avoid|cool': 5, 'avoid|avoid': 4, 'avoid|talk': 2,
};

export interface BondRead {
  parts: ScorePart[];
  hints: string[]; // 조합 수준의 조언. 상대의 답 내용은 드러내지 않는다.
  strengths: string[];
}

export function readBond(me: Profile, them: Profile, sharedInterests: number, sharedValues: number, sharedStyles: number): BondRead {
  const a = me.bond, b = them.bond;
  const hints: string[] = [];
  const strengths: string[] = [];

  // ① 가까워지는 속도 (25) — 조합의 위험 패턴만 감점한다
  let pace = 25;
  const chase = (anx(a) >= HIGH && avo(b) >= HIGH) || (anx(b) >= HIGH && avo(a) >= HIGH);
  if (chase) {
    pace -= 15; // 한쪽은 다가가고 한쪽은 물러서는 고리(요구–철수)
    hints.push('가까워지는 속도가 서로 다를 수 있어요. 첫 만남은 짧게, 다음 약속은 그 자리에서 정해두면 편해요.');
  } else if (avo(a) >= HIGH && avo(b) >= HIGH) {
    pace -= 8;
    hints.push('두 분 다 천천히 여는 편이에요. 침묵이 어색하지 않도록 함께 할 거리가 있는 장소가 좋아요.');
  } else if (anx(a) >= HIGH && anx(b) >= HIGH) {
    pace -= 5;
    hints.push('두 분 다 연락에 마음을 쓰는 편이에요. 만난 날 저녁에 짧게 안부를 주고받으면 좋아요.');
  } else strengths.push('가까워지는 속도가 잘 맞는 조합이에요');

  // ② 다툼과 연락 (15)
  const conflictRaw = CONFLICT_FIT[[a.conflict, b.conflict].sort().join('|')];
  const gap = Math.abs(CONTACT_ORDER.indexOf(a.contact) - CONTACT_ORDER.indexOf(b.contact));
  const process = Math.round(((conflictRaw + [10, 6, 2][gap]) / 20) * 15);
  if (conflictRaw <= 2) hints.push('서운한 일을 푸는 방식이 달라요. 불편한 게 생기면 "지금 말해도 돼요?" 하고 먼저 물어보는 게 도움이 돼요.');
  if (gap === 2) hints.push('기대하는 연락 빈도가 달라요. 첫 만남에서 편한 연락 빈도를 가볍게 이야기해보세요.');
  if (conflictRaw >= 8 && gap === 0) strengths.push('연락과 대화 방식에 대한 기대가 비슷해요');

  // ③ 원하는 방향 (20) — 원하는 관계 + 중요하게 여기는 것
  const intent = a.intent === b.intent ? 8 : 5; // 정반대는 intentClash 에서 이미 걸러짐
  const values = Math.round((Math.min(sharedValues, 2) / 2) * 12);
  if (a.intent === b.intent) strengths.push('원하는 관계의 모습이 같아요');

  // ④ 속마음 (20) — 내가 바라는 것을 상대가 잘 주는가, 그 반대는
  const dir = (needs: Need[], gives: Need[]) =>
    needs.length === 0 ? 5 : Math.round((Math.min(needs.filter((n) => gives.includes(n)).length, 2) / Math.min(needs.length, 2)) * 10);
  const mine = dir(a.needs, b.gives), theirs = dir(b.needs, a.gives);
  if (a.needs.length && mine >= 5) strengths.push(`당신이 바라는 "${needLabel(a.needs.find((n) => b.gives.includes(n))!)}"을(를) 잘 주는 사람이에요`);
  if (a.needs.length && mine === 0) hints.push('당신이 가장 바라는 것을 상대가 먼저 알아채기는 어려울 수 있어요. 원하는 걸 말로 알려주는 게 빨라요.');

  // ⑤ 사랑의 언어 (10) — 주는 방식과 받고 싶은 방식이 만나는가
  const love = (a.loveGet === b.loveGive ? 5 : 0) + (b.loveGet === a.loveGive ? 5 : 0);
  if (love === 10) strengths.push('마음을 표현하는 방식이 서로에게 잘 닿아요');
  if (love === 0) hints.push('마음을 표현하는 방식이 서로 달라요. 표현이 적어 보여도 다른 방식으로 전하고 있을 수 있어요.');

  // ⑥ 함께할 거리 (10) — 첫 대화의 재료
  const together = Math.round((Math.min(sharedInterests, 3) / 3) * 6) + (sharedStyles ? 4 : 0);

  return {
    parts: [
      { label: '가까워지는 속도', points: Math.max(0, pace), max: 25 },
      { label: '다툼과 연락', points: process, max: 15 },
      { label: '원하는 방향', points: intent + values, max: 20 },
      { label: '속마음', points: mine + theirs, max: 20 },
      { label: '사랑의 언어', points: love, max: 10 },
      { label: '함께할 거리', points: together, max: 10 },
    ],
    hints,
    strengths,
  };
}

/** 서로를 조금씩 더 알아가는 순서의 질문 3개 (가벼운 것 → 조금 깊은 것). */
export function talkLadder(sharedInterest: string | null, theirName: string): string[] {
  return [
    sharedInterest ? `"${sharedInterest}"은(는) 어떻게 시작하게 됐어요?` : `요즘 쉬는 날엔 주로 뭐 하세요?`,
    sharedInterest ? `${sharedInterest} 하면서 제일 좋았던 날은 언제였어요?` : `최근에 제일 좋았던 하루는 어떤 날이었어요?`,
    `요즘 제일 기대하고 있는 일이 있어요?`,
  ].map((q) => q.replace('{name}', theirName));
}
