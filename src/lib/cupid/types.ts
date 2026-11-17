import type { CourtState } from './machine';

export type Gender = 'female' | 'male' | 'other';
export type Drink = 'none' | 'social' | 'often';
export type Dealbreaker = 'smoker' | 'heavy_drinker' | 'no_pets' | 'other_city';
export type DateStyle = 'coffee' | 'meal' | 'walk' | 'culture' | 'activity';
export type Tone = 'polite' | 'witty' | 'direct';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const PARTS = ['lunch', 'afternoon', 'evening'] as const;
export type Day = (typeof DAYS)[number];
export type Part = (typeof PARTS)[number];
export type SlotId = `${Day}-${Part}`;

export const GENDERS: { id: Gender; label: string }[] = [
  { id: 'female', label: '여성' },
  { id: 'male', label: '남성' },
  { id: 'other', label: '기타' },
];
export const CITIES = ['서울', '부산', '대구', '인천', '대전', '광주'];
export const INTERESTS = [
  '러닝', '등산', '요리', '맛집 탐방', '영화', '전시', '독서',
  '여행', '음악·공연', '게임', '반려동물', '커피', '사진', '요가',
];
export const VALUES = ['유머', '성장', '안정', '가족', '모험', '배려', '솔직함', '독립성'];
export const DEALBREAKERS: { id: Dealbreaker; label: string }[] = [
  { id: 'smoker', label: '흡연자' },
  { id: 'heavy_drinker', label: '술을 자주 마시는 사람' },
  { id: 'no_pets', label: '반려동물을 싫어하는 사람' },
  { id: 'other_city', label: '다른 도시 (장거리)' },
];
export const DATE_STYLES: { id: DateStyle; label: string; venue: string }[] = [
  { id: 'coffee', label: '☕ 카페', venue: '조용한 카페에서 커피 한 잔' },
  { id: 'meal', label: '🍝 식사', venue: '예약되는 캐주얼 식당에서 식사' },
  { id: 'walk', label: '🌿 산책', venue: '공원 산책 + 테이크아웃 커피' },
  { id: 'culture', label: '🖼️ 전시', venue: '전시 관람 후 근처 카페' },
  { id: 'activity', label: '🎨 클래스', venue: '원데이 클래스 함께 듣기' },
];
export const DRINKS: { id: Drink; label: string }[] = [
  { id: 'none', label: '안 마심' },
  { id: 'social', label: '가끔' },
  { id: 'often', label: '자주' },
];
export const TONES: { id: Tone; label: string }[] = [
  { id: 'polite', label: '🎩 정중' },
  { id: 'witty', label: '🏹 재치' },
  { id: 'direct', label: '⚡ 직설' },
];
export const DAY_LABEL: Record<Day, string> = {
  mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
};
export const PART_LABEL: Record<Part, string> = { lunch: '점심', afternoon: '오후', evening: '저녁' };
export const PART_HOUR: Record<Part, number> = { lunch: 12, afternoon: 15, evening: 19 };

export interface Profile {
  name: string;
  birth: { year: number; month: number; day: number };
  gender: Gender;
  seeking: Gender[];
  ageRange: [number, number];
  city: string;
  interests: string[];
  values: string[];
  smoker: boolean;
  drink: Drink;
  likesPets: boolean;
  dealbreakers: Dealbreaker[]; // 비공개 — 에이전트끼리도 예/아니오만 교환
  dateStyles: DateStyle[];
  slots: SlotId[]; // 비공개 — 겹치는 시간만 드러남
  tone: Tone;
}

export interface Persona extends Profile {
  id: string;
  emoji: string;
  job: string;
  bio: string;
}

// 상대에게 공개되는 정보만 담은 카드 (A2A의 Agent Card에 해당).
export interface AgentCard {
  id: string;
  name: string;
  emoji: string;
  age: number;
  city: string;
  job: string;
  bio: string;
  interests: string[];
}

export interface A2AMessage {
  from: 'mine' | 'theirs';
  kind: 'hello' | 'screen' | 'explore' | 'propose' | 'counter' | 'accept' | 'bow_out';
  text: string;
  state: CourtState; // 이 메시지 직후의 상태
}

export interface DateSlot {
  id: SlotId;
  iso: string; // KST, 예: 2026-11-21T15:00:00+09:00
  label: string; // 예: 11월 21일 (토) 오후 3시
}

export interface Proposal {
  slot: DateSlot;
  alternatives: DateSlot[];
  venue: string;
  icebreaker: string;
  reasons: string[];
}

export interface ScorePart {
  label: string;
  points: number;
  max: number;
}

export interface Courtship {
  id: string;
  card: AgentCard;
  state: CourtState;
  score: number | null;
  breakdown: ScorePart[];
  messages: A2AMessage[];
  proposal: Proposal | null;
  closedReason: string | null;
}
