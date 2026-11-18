import {
  CITIES, DATE_STYLES, DAYS, DEALBREAKERS, DRINKS, GENDERS, INTERESTS, PARTS, TONES, VALUES,
  type Profile, type SlotId,
} from './types';
import { CLOSENESS_ITEMS, CONFLICTS, CONTACTS, INTENTS, LOVE_LANGS, NEEDS, type Bond } from './psych';

const pick = <T extends string>(v: unknown, allowed: readonly T[], min: number, name: string): T[] => {
  const out = Array.isArray(v) ? allowed.filter((a) => v.includes(a)) : [];
  if (out.length < min) throw new Error(`${name}을(를) ${min}개 이상 골라주세요.`);
  return out;
};
const one = <T extends string>(v: unknown, allowed: readonly T[], name: string): T => {
  if (!allowed.includes(v as T)) throw new Error(`${name}을(를) 선택해주세요.`);
  return v as T;
};
const int = (v: unknown, min: number, max: number, name: string): number => {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name}을(를) 확인해주세요.`);
  return n;
};

const ALL_SLOTS = DAYS.flatMap((d) => PARTS.map((p) => `${d}-${p}` as SlotId));

/** 화면과 API가 같이 쓰는 프로필 검증. 허용 목록에 없는 값은 버린다. */
export function parseProfile(b: any): Profile {
  if (!b || typeof b !== 'object') throw new Error('프로필이 비어 있어요.');
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 20) : '';
  if (!name) throw new Error('이름을 입력해주세요.');

  const year = int(b.birth?.year, 1940, 2007, '태어난 해');
  const month = int(b.birth?.month, 1, 12, '태어난 달');
  const day = int(b.birth?.day, 1, 31, '태어난 날');
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCMonth() !== month - 1) throw new Error('없는 날짜예요. 생일을 확인해주세요.');

  const lo = int(b.ageRange?.[0], 19, 80, '만나고 싶은 나이');
  const hi = int(b.ageRange?.[1], 19, 80, '만나고 싶은 나이');
  const ids = <T extends string>(xs: { id: T }[]) => xs.map((x) => x.id);

  // 슬롯은 사용자가 고른 순서(=선호 순서)를 유지한다.
  const slots = (Array.isArray(b.slots) ? b.slots : []).filter(
    (s: unknown, i: number, a: unknown[]) => ALL_SLOTS.includes(s as SlotId) && a.indexOf(s) === i,
  ) as SlotId[];
  if (!slots.length) throw new Error('가능한 시간을 1개 이상 골라주세요.');

  return {
    name,
    birth: { year, month, day },
    gender: one(b.gender, ids(GENDERS), '성별'),
    seeking: pick(b.seeking, ids(GENDERS), 1, '만나고 싶은 성별'),
    ageRange: [Math.min(lo, hi), Math.max(lo, hi)],
    city: one(b.city, CITIES, '도시'),
    interests: pick(b.interests, INTERESTS, 2, '관심사'),
    values: pick(b.values, VALUES, 1, '가치관').slice(0, 3),
    smoker: Boolean(b.smoker),
    drink: one(b.drink, ids(DRINKS), '음주'),
    likesPets: Boolean(b.likesPets),
    dealbreakers: pick(b.dealbreakers, ids(DEALBREAKERS), 0, '비공개 조건'),
    dateStyles: pick(b.dateStyles, ids(DATE_STYLES), 1, '데이트 스타일'),
    slots,
    tone: one(b.tone, ids(TONES), '에이전트 말투'),
    bond: {
      intent: one(b.bond?.intent, ids(INTENTS), '원하는 관계'),
      contact: one(b.bond?.contact, ids(CONTACTS), '연락 빈도'),
      conflict: one(b.bond?.conflict, ids(CONFLICTS), '갈등 방식'),
      closeness: CLOSENESS_ITEMS.map((_, i) => int(b.bond?.closeness?.[i], 0, 2, '가까워지는 방식')) as Bond['closeness'],
      loveGive: one(b.bond?.loveGive, ids(LOVE_LANGS), '마음을 표현하는 방식'),
      loveGet: one(b.bond?.loveGet, ids(LOVE_LANGS), '사랑받는다고 느끼는 방식'),
      gives: pick(b.bond?.gives, ids(NEEDS), 1, '내가 잘 주는 것').slice(0, 2),
      needs: pick(b.bond?.needs, ids(NEEDS), 0, '바라는 것').slice(0, 3),
    },
  };
}
