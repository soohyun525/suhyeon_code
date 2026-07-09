// 궁합 (compatibility) engine — classic Saju pair heuristics between two
// charts: Day-Master element relations, branch harmonies (육합/삼합) and
// clashes (충), yin-yang balance, and element complementarity.

import type { SajuChart } from './calculator';
import type { Element } from './constants';

export interface CompatFactor {
  label: string;
  detail: string;
  delta: number; // signed contribution to the score
}

export interface CompatResult {
  score: number; // 0–100
  label: string;
  factors: CompatFactor[];
}

const EL_INDEX: Record<Element, number> = { Wood: 0, Fire: 1, Earth: 2, Metal: 3, Water: 4 };
const EL_NAME = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

// 육합 — the six harmony pairs of branches.
const YUKHAP: [number, number][] = [
  [0, 1], // 子丑
  [2, 11], // 寅亥
  [3, 10], // 卯戌
  [4, 9], // 辰酉
  [5, 8], // 巳申
  [6, 7], // 午未
];
// 충 — the six clash pairs.
const CHUNG: [number, number][] = [
  [0, 6],
  [1, 7],
  [2, 8],
  [3, 9],
  [4, 10],
  [5, 11],
];
// 삼합 trio groups by branch index.
const TRIO_GROUP: Record<number, number> = {
  8: 0, 0: 0, 4: 0, // 申子辰
  2: 1, 6: 1, 10: 1, // 寅午戌
  5: 2, 9: 2, 1: 2, // 巳酉丑
  11: 3, 3: 3, 7: 3, // 亥卯未
};

const inPairs = (pairs: [number, number][], a: number, b: number) =>
  pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export function computeCompat(A: SajuChart, B: SajuChart): CompatResult {
  const factors: CompatFactor[] = [];
  const push = (label: string, detail: string, delta: number) =>
    factors.push({ label, detail, delta });

  const aName = A.birth.name || 'You';
  const bName = B.birth.name || 'Your friend';

  // ── 1. Day Master element relationship ──
  const dA = EL_INDEX[A.dayMaster.element];
  const dB = EL_INDEX[B.dayMaster.element];
  if (dA === dB) {
    push(
      'Twin energy',
      `Both Day Masters are ${EL_NAME[dA]} — you get each other instantly.`,
      8,
    );
  } else if ((dA + 1) % 5 === dB) {
    push(
      'Nurturing flow',
      `${aName}'s ${EL_NAME[dA]} feeds ${bName}'s ${EL_NAME[dB]} — one naturally supports the other.`,
      14,
    );
  } else if ((dB + 1) % 5 === dA) {
    push(
      'Nurturing flow',
      `${bName}'s ${EL_NAME[dB]} feeds ${aName}'s ${EL_NAME[dA]} — one naturally supports the other.`,
      14,
    );
  } else if ((dA + 2) % 5 === dB || (dB + 2) % 5 === dA) {
    push(
      'Sparks & friction',
      `${EL_NAME[dA]} and ${EL_NAME[dB]} are a control pair — magnetic, but it needs maturity.`,
      -8,
    );
  }

  // ── 2. Day branch relations (the marriage palace) ──
  const bA = A.pillars.day.branchIndex;
  const bB = B.pillars.day.branchIndex;
  if (inPairs(YUKHAP, bA, bB)) {
    push('Soulmate knot (육합)', 'Your Day branches form one of the six harmonies — a classic bond sign.', 15);
  } else if (TRIO_GROUP[bA] !== undefined && TRIO_GROUP[bA] === TRIO_GROUP[bB]) {
    push('Same team (삼합)', 'Your Day branches belong to the same harmony trio — easy teamwork.', 10);
  } else if (inPairs(CHUNG, bA, bB)) {
    push('Day clash (충)', 'Your Day branches clash — exciting, but expect friction at close range.', -12);
  }

  // ── 3. Zodiac (year branch) relations ──
  const yA = A.pillars.year.branchIndex;
  const yB = B.pillars.year.branchIndex;
  if (inPairs(YUKHAP, yA, yB)) {
    push('Zodiac harmony', `${A.zodiacAnimal} and ${B.zodiacAnimal} are a harmonious pair.`, 6);
  } else if (inPairs(CHUNG, yA, yB)) {
    push('Zodiac clash', `${A.zodiacAnimal} and ${B.zodiacAnimal} traditionally butt heads.`, -6);
  }

  // ── 4. Yin-Yang balance of the Day Masters ──
  if (A.dayMaster.yin !== B.dayMaster.yin) {
    push('Yin–Yang balance', 'One yin, one yang — complementary energy by default.', 4);
  }

  // ── 5. Element complementarity ──
  for (const [X, Y, xn, yn] of [
    [A, B, aName, bName],
    [B, A, bName, aName],
  ] as [SajuChart, SajuChart, string, string][]) {
    const fills = X.lackingElements.filter((el) => Y.elementCounts[el] >= 2);
    if (fills.length) {
      push(
        'Missing piece',
        `${yn} is rich in ${fills.join(' & ')} — exactly what ${xn}'s chart is missing.`,
        7,
      );
    }
  }

  const raw = 50 + factors.reduce((s, f) => s + f.delta, 0);
  const score = Math.max(8, Math.min(98, raw));

  const label =
    score >= 85
      ? 'Written in the stars ✨'
      : score >= 70
        ? 'Green flags everywhere 💚'
        : score >= 55
          ? 'Good vibes, small homework 🌤️'
          : score >= 40
            ? 'Opposites in training ⚡'
            : 'Chaotic duo energy 🌪️';

  return { score, label, factors };
}
