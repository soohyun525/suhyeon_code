// Advanced Manseryeok layers: Ten Gods (십성), hidden stems (지장간), and the
// Twelve Life Stages (십이운성). These turn the bare Four Pillars into the kind
// of detailed chart a professional manseryeok shows.

import { STEMS, BRANCHES, type Element } from './constants';

const mod = (n: number, m: number) => ((n % m) + m) % m;

// Element index in the generating cycle: Wood→Fire→Earth→Metal→Water→Wood.
const EL_INDEX: Record<Element, number> = { Wood: 0, Fire: 1, Earth: 2, Metal: 3, Water: 4 };
const generates = (a: number) => (a + 1) % 5; // a produces (a+1)
const controls = (a: number) => (a + 2) % 5; // a overcomes (a+2)

export interface TenGod {
  ko: string; // 십성 (Korean)
  rom: string;
  en: string; // short English gloss
}

const G = (ko: string, rom: string, en: string): TenGod => ({ ko, rom, en });

/**
 * Ten God of a target stem relative to the Day Master.
 * Uses element relationship + matching/differing polarity (음양).
 */
export function tenGod(dayStemIndex: number, targetStemIndex: number): TenGod {
  const d = STEMS[dayStemIndex];
  const t = STEMS[targetStemIndex];
  const D = EL_INDEX[d.element];
  const T = EL_INDEX[t.element];
  const same = d.yin === t.yin;

  if (T === D) return same ? G('비견', 'Bigyeon', 'Peer') : G('겁재', 'Geopjae', 'Rival');
  if (generates(D) === T) return same ? G('식신', 'Siksin', 'Creativity') : G('상관', 'Sanggwan', 'Expression');
  if (controls(D) === T) return same ? G('편재', 'Pyeonjae', 'Bold Wealth') : G('정재', 'Jeongjae', 'Steady Wealth');
  if (controls(T) === D) return same ? G('편관', 'Pyeongwan', 'Challenge') : G('정관', 'Jeonggwan', 'Authority');
  return same ? G('편인', 'Pyeonin', 'Insight') : G('정인', 'Jeongin', 'Support');
}

// 지장간 — hidden stems inside each branch (stem indices; main/정기 is last).
const HIDDEN: number[][] = [
  [8, 9], // 子  壬 癸
  [9, 7, 5], // 丑  癸 辛 己
  [4, 2, 0], // 寅  戊 丙 甲
  [0, 1], // 卯  甲 乙
  [1, 9, 4], // 辰  乙 癸 戊
  [4, 6, 2], // 巳  戊 庚 丙
  [2, 5, 3], // 午  丙 己 丁
  [3, 1, 5], // 未  丁 乙 己
  [4, 8, 6], // 申  戊 壬 庚
  [6, 7], // 酉  庚 辛
  [7, 3, 4], // 戌  辛 丁 戊
  [4, 0, 8], // 亥  戊 甲 壬
];

export function hiddenStems(branchIndex: number): number[] {
  return HIDDEN[branchIndex];
}

/** Main hidden stem (정기) of a branch — used for the branch's Ten God. */
export function branchMainStem(branchIndex: number): number {
  const h = HIDDEN[branchIndex];
  return h[h.length - 1];
}

export function branchTenGod(dayStemIndex: number, branchIndex: number): TenGod {
  return tenGod(dayStemIndex, branchMainStem(branchIndex));
}

// 십이운성 — the Twelve Life Stages.
const STAGES: { ko: string; rom: string; en: string }[] = [
  { ko: '장생', rom: 'Jangsaeng', en: 'Birth' },
  { ko: '목욕', rom: 'Mokyok', en: 'Bath' },
  { ko: '관대', rom: 'Gwandae', en: 'Coming of Age' },
  { ko: '건록', rom: 'Geonrok', en: 'Prosperity' },
  { ko: '제왕', rom: 'Jewang', en: 'Peak' },
  { ko: '쇠', rom: 'Soe', en: 'Decline' },
  { ko: '병', rom: 'Byeong', en: 'Sickness' },
  { ko: '사', rom: 'Sa', en: 'Death' },
  { ko: '묘', rom: 'Myo', en: 'Tomb' },
  { ko: '절', rom: 'Jeol', en: 'Void' },
  { ko: '태', rom: 'Tae', en: 'Conception' },
  { ko: '양', rom: 'Yang', en: 'Nurture' },
];

// 장생 branch for each day stem (index by stem). Yang stems go forward through
// the branches, Yin stems go backward.
const JANGSAENG_BRANCH = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3]; // 甲乙丙丁戊己庚辛壬癸

export function twelveStage(dayStemIndex: number, branchIndex: number) {
  const start = JANGSAENG_BRANCH[dayStemIndex];
  const yang = dayStemIndex % 2 === 0;
  const idx = yang ? mod(branchIndex - start, 12) : mod(start - branchIndex, 12);
  return STAGES[idx];
}

export { STEMS, BRANCHES };
