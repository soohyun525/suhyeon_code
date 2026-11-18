// 관계 심리 분석 요소. 근거와 원칙은 docs/CUPID_PSYCHOLOGY.md.
//
// 원칙 요약
//  1. 겸손: 만나기 전 정보로 "끌림"은 예측되지 않는다. 점수는 궁합 예언이 아니라
//     "첫 만남이 순조로울 조건이 얼마나 갖춰졌나"만 말한다.
//  2. 사람이 아니라 조합에 점수를 매긴다. 불안하거나 거리를 두는 성향 자체로 감점하지 않는다.
//  3. 닮음보다 어긋남을 본다. 관계 목표·연락 기대·갈등 방식처럼 어긋나면 힘든 것을 맞춘다.
//  4. 검증되지 않은 유형론(MBTI, 사랑의 언어, 사주)은 점수에 쓰지 않는다.
//  5. 답은 비공개. 상대에게는 "맞는 정도"와 조합 수준의 조언만 간다.

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

export interface Bond {
  intent: Intent;
  contact: Contact;
  conflict: Conflict;
  closeness: [Level, Level, Level, Level];
}
export const EMPTY_BOND: Bond = { intent: 'open', contact: 'daily', conflict: 'cool', closeness: [1, 0, 1, 0] };

const anx = (b: Bond) => b.closeness[0] + b.closeness[1]; // 0..4
const avo = (b: Bond) => b.closeness[2] + b.closeness[3]; // 0..4
const HIGH = 3;

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

  // ① 가까워지는 속도 (30) — 조합의 위험 패턴만 감점한다
  let pace = 30;
  const chase = (anx(a) >= HIGH && avo(b) >= HIGH) || (anx(b) >= HIGH && avo(a) >= HIGH);
  if (chase) {
    pace -= 18; // 한쪽은 다가가고 한쪽은 물러서는 고리(요구–철수)
    hints.push('가까워지는 속도가 서로 다를 수 있어요. 첫 만남은 짧게, 다음 약속은 그 자리에서 정해두면 편해요.');
  } else if (avo(a) >= HIGH && avo(b) >= HIGH) {
    pace -= 10;
    hints.push('두 분 다 천천히 여는 편이에요. 침묵이 어색하지 않도록 함께 할 거리가 있는 장소가 좋아요.');
  } else if (anx(a) >= HIGH && anx(b) >= HIGH) {
    pace -= 6;
    hints.push('두 분 다 연락에 마음을 쓰는 편이에요. 만난 날 저녁에 짧게 안부를 주고받으면 좋아요.');
  } else strengths.push('가까워지는 속도가 잘 맞는 조합이에요');

  // ② 다툼과 연락 (20)
  const conflict = CONFLICT_FIT[[a.conflict, b.conflict].sort().join('|')];
  const gap = Math.abs(CONTACT_ORDER.indexOf(a.contact) - CONTACT_ORDER.indexOf(b.contact));
  const contact = [10, 6, 2][gap];
  if (conflict <= 2) hints.push('서운한 일을 푸는 방식이 달라요. 불편한 게 생기면 "지금 말해도 돼요?" 하고 먼저 물어보는 게 도움이 돼요.');
  if (gap === 2) hints.push('기대하는 연락 빈도가 달라요. 첫 만남에서 편한 연락 빈도를 가볍게 이야기해보세요.');
  if (conflict >= 8 && gap === 0) strengths.push('연락과 대화 방식에 대한 기대가 비슷해요');

  // ③ 방향 (25) — 원하는 관계 + 중요하게 여기는 것
  const intent = a.intent === b.intent ? 10 : 6; // 정반대는 intentClash 에서 이미 걸러짐
  const values = Math.round((Math.min(sharedValues, 2) / 2) * 15);
  if (a.intent === b.intent) strengths.push('원하는 관계의 모습이 같아요');

  // ④ 함께할 거리 (25) — 첫 대화의 재료
  const interests = Math.round((Math.min(sharedInterests, 3) / 3) * 15);
  const styles = sharedStyles ? 10 : 0;

  return {
    parts: [
      { label: '가까워지는 속도', points: Math.max(0, pace), max: 30 },
      { label: '다툼과 연락', points: conflict + contact, max: 20 },
      { label: '원하는 방향', points: intent + values, max: 25 },
      { label: '함께할 거리', points: interests + styles, max: 25 },
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
