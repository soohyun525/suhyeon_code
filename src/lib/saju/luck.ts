// Luck cycles: Daeun (대운, the 10-year major-fortune pillars) and Saeun
// (세운, the yearly pillars). Daeun direction and start age follow the
// classic rules (양남음녀 순행 / 음남양녀 역행; ~3 days per year to the
// bounding solar term).

import { STEMS, BRANCHES } from './constants';
import { solarLongitude } from './astronomy';
import { tenGod, type TenGod } from './advanced';

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function gapjaIndex(stemIndex: number, branchIndex: number): number {
  for (let n = 0; n < 60; n++) {
    if (n % 10 === stemIndex && n % 12 === branchIndex) return n;
  }
  return 0;
}

// Solve for the Julian Day near `jdGuess` where the Sun reaches `target` long.
function solveTo(jdGuess: number, target: number): number {
  let x = jdGuess;
  for (let i = 0; i < 20; i++) {
    const l = solarLongitude(x);
    let diff = target - l;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    x += diff / 0.98565;
  }
  return x;
}

// Sectional solar terms (節) sit at longitudes ≡ 15 (mod 30).
function nextNodeLongitude(lambda: number, forward: boolean): number {
  const base = Math.floor((lambda - 15) / 30);
  if (forward) return mod((base + 1) * 30 + 15, 360);
  return mod(base * 30 + 15, 360);
}

export interface DaeunPillar {
  age: number;
  stem: { han: string; rom: string; element: string };
  branch: { han: string; rom: string; element: string; animal: string };
  tenGod: TenGod; // of the stem, relative to the Day Master
}

export interface DaeunResult {
  forward: boolean;
  startAge: number;
  pillars: DaeunPillar[];
}

export function computeDaeun(opts: {
  birthJDUT: number;
  dayStemIndex: number;
  monthStemIndex: number;
  monthBranchIndex: number;
  yearStemIndex: number;
  gender?: 'male' | 'female' | 'other';
}): DaeunResult {
  const yangYear = opts.yearStemIndex % 2 === 0;
  const male = opts.gender !== 'female'; // default to "male direction" if unspecified
  const forward = (yangYear && male) || (!yangYear && !male);

  const lambda = solarLongitude(opts.birthJDUT);
  const target = nextNodeLongitude(lambda, forward);
  const nodeJD = solveTo(opts.birthJDUT, target);
  const days = Math.abs(forward ? nodeJD - opts.birthJDUT : opts.birthJDUT - nodeJD);
  const startAge = Math.max(1, Math.round(days / 3));

  const monthGapja = gapjaIndex(opts.monthStemIndex, opts.monthBranchIndex);
  const dir = forward ? 1 : -1;
  const pillars: DaeunPillar[] = [];
  for (let i = 0; i < 9; i++) {
    const gj = mod(monthGapja + dir * (i + 1), 60);
    const s = STEMS[gj % 10];
    const b = BRANCHES[gj % 12];
    pillars.push({
      age: startAge + i * 10,
      stem: { han: s.han, rom: s.rom, element: s.element },
      branch: { han: b.han, rom: b.rom, element: b.element, animal: b.animal },
      tenGod: tenGod(opts.dayStemIndex, gj % 10),
    });
  }
  return { forward, startAge, pillars };
}

export interface SaeunPillar {
  year: number;
  stem: { han: string; rom: string; element: string };
  branch: { han: string; rom: string; element: string; animal: string };
  tenGod: TenGod;
}

export function computeSaeun(dayStemIndex: number, fromYear: number, count: number): SaeunPillar[] {
  const out: SaeunPillar[] = [];
  for (let i = 0; i < count; i++) {
    const y = fromYear + i;
    const gj = mod(y - 4, 60);
    const s = STEMS[gj % 10];
    const b = BRANCHES[gj % 12];
    out.push({
      year: y,
      stem: { han: s.han, rom: s.rom, element: s.element },
      branch: { han: b.han, rom: b.rom, element: b.element, animal: b.animal },
      tenGod: tenGod(dayStemIndex, gj % 10),
    });
  }
  return out;
}
