// 신살 (Sinsal) — the "spirit stars" of a chart. We compute a focused set of
// the most popular and meaningful ones, each with where it appears.

const POS = ['Year', 'Month', 'Day', 'Hour'] as const;

export interface Sinsal {
  ko: string;
  rom: string;
  en: string;
  desc: string;
  where: string[]; // which pillars it lands on
}

// 삼합 trio → target branch, keyed by any branch in the trio.
function trioTarget(refBranch: number, map: Record<number, number>): number {
  return map[refBranch];
}

const groupOf: Record<number, number> = {
  8: 0, 0: 0, 4: 0, // 申子辰 Water
  2: 1, 6: 1, 10: 1, // 寅午戌 Fire
  5: 2, 9: 2, 1: 2, // 巳酉丑 Metal
  11: 3, 3: 3, 7: 3, // 亥卯未 Wood
};
const DOHWA = [9, 3, 6, 0]; // by group: Water→酉, Fire→卯, Metal→午, Wood→子
const YEOKMA = [2, 8, 11, 5]; // Water→寅, Fire→申, Metal→亥, Wood→巳
const HWAGAE = [4, 10, 1, 7]; // Water→辰, Fire→戌, Metal→丑, Wood→未

// 천을귀인 by day stem → two branches.
const CHEONEUL: number[][] = [
  [1, 7], // 甲
  [0, 8], // 乙
  [11, 9], // 丙
  [11, 9], // 丁
  [1, 7], // 戊
  [0, 8], // 己
  [1, 7], // 庚
  [2, 6], // 辛
  [3, 5], // 壬
  [3, 5], // 癸
];

// 양인 by stem index → branch.
const YANGIN = [3, 4, 6, 7, 6, 7, 9, 10, 0, 1];

export function computeSinsal(opts: {
  dayStemIndex: number;
  dayGapja: number;
  yearBranchIndex: number;
  dayBranchIndex: number;
  branches: (number | null)[]; // [year, month, day, hour]
}): Sinsal[] {
  const { branches } = opts;
  const found: Sinsal[] = [];

  const where = (target: number): string[] =>
    branches.map((b, i) => (b === target ? POS[i] : null)).filter(Boolean) as string[];

  // Reference branch for trio-based stars: use both year and day branches.
  const refs = [opts.yearBranchIndex, opts.dayBranchIndex];

  const trioStar = (
    table: number[],
    ko: string,
    rom: string,
    en: string,
    desc: string,
  ) => {
    const hits = new Set<string>();
    for (const ref of refs) {
      const g = groupOf[ref];
      if (g === undefined) continue;
      where(table[g]).forEach((w) => hits.add(w));
    }
    if (hits.size) found.push({ ko, rom, en, desc, where: [...hits] });
  };

  trioStar(DOHWA, '도화살', 'Dohwa', 'Peach Blossom', 'Charm, attractiveness, romance and popularity.');
  trioStar(YEOKMA, '역마살', 'Yeokma', 'Travel Star', 'Movement, travel, change — often a life lived across places.');
  trioStar(HWAGAE, '화개살', 'Hwagae', 'Canopy Star', 'Art, spirituality and intellect, with a streak of solitude.');

  // 천을귀인 (by day stem)
  {
    const targets = CHEONEUL[opts.dayStemIndex];
    const hits = new Set<string>();
    targets.forEach((t) => where(t).forEach((w) => hits.add(w)));
    if (hits.size)
      found.push({
        ko: '천을귀인',
        rom: 'Cheoneul Gwiin',
        en: 'Noble Helper',
        desc: 'The most fortunate star — influential people appear to help you.',
        where: [...hits],
      });
  }

  // 양인살 (by day stem)
  {
    const t = YANGIN[opts.dayStemIndex];
    const w = where(t);
    if (w.length)
      found.push({
        ko: '양인살',
        rom: 'Yangin',
        en: 'Blade Star',
        desc: 'Fierce drive and willpower; powerful when channeled, risky when not.',
        where: w,
      });
  }

  // 공망 (Void) — by the day pillar's decade (旬).
  {
    const xun = Math.floor(opts.dayGapja / 10); // 0..5
    const voidBranches = [
      [10, 11],
      [8, 9],
      [6, 7],
      [4, 5],
      [2, 3],
      [0, 1],
    ][xun];
    const hits = new Set<string>();
    voidBranches.forEach((t) => where(t).forEach((w) => hits.add(w)));
    if (hits.size)
      found.push({
        ko: '공망',
        rom: 'Gongmang',
        en: 'Void',
        desc: 'An area that feels empty or detached — invites a lighter, non-grasping approach.',
        where: [...hits],
      });
  }

  return found;
}
