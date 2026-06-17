// The Manseryeok engine: turn a birth moment into the Four Pillars
// (사주팔자) and a five-element analysis. All output is English-friendly.

import {
  BRANCHES,
  STEMS,
  ELEMENTS,
  type Branch,
  type Element,
  type Stem,
} from './constants';
import { julianDay, julianDayNumber, solarLongitude, solarTermJD } from './astronomy';
import {
  tenGod,
  branchTenGod,
  hiddenStems,
  twelveStage,
  type TenGod,
} from './advanced';
import { computeDaeun, computeSaeun, type DaeunResult, type SaeunPillar } from './luck';
import { computeSinsal, type Sinsal } from './sinsal';

export interface BirthData {
  name?: string;
  gender?: 'male' | 'female' | 'other';
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23 (local clock time)
  minute: number; // 0-59
  timeUnknown?: boolean; // if true, the hour pillar is omitted
  tzOffset: number; // hours east of UTC, e.g. Korea = 9, New York = -5
  birthplace?: string;
}

export interface Pillar {
  stem: Stem;
  branch: Branch;
  stemIndex: number;
  branchIndex: number;
  tenGod: TenGod | null; // stem's Ten God (null = the Day Master itself)
  branchTenGod: TenGod;
  hidden: { han: string; rom: string; element: Element }[]; // 지장간
  stage: { ko: string; rom: string; en: string }; // 십이운성
}

export interface SajuChart {
  birth: BirthData;
  sajuYear: number; // solar (입춘-adjusted) year used for the pillars
  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: Pillar | null;
  };
  hasHour: boolean;
  dayMaster: Stem; // 일간 — "the self"
  zodiacAnimal: string; // from the year branch
  elementCounts: Record<Element, number>;
  dominantElement: Element;
  lackingElements: Element[];
  daeun: DaeunResult; // 대운 — 10-year fortune pillars
  saeun: SaeunPillar[]; // 세운 — yearly pillars (a window around now)
  currentSaeun: SaeunPillar; // this calendar year
  sinsal: Sinsal[]; // 신살 — spirit stars present in the chart
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

function pillar(stemIndex: number, branchIndex: number, dayStemIndex: number, isSelf: boolean): Pillar {
  return {
    stemIndex,
    branchIndex,
    stem: STEMS[stemIndex],
    branch: BRANCHES[branchIndex],
    tenGod: isSelf ? null : tenGod(dayStemIndex, stemIndex),
    branchTenGod: branchTenGod(dayStemIndex, branchIndex),
    hidden: hiddenStems(branchIndex).map((s) => ({
      han: STEMS[s].han,
      rom: STEMS[s].rom,
      element: STEMS[s].element,
    })),
    stage: twelveStage(dayStemIndex, branchIndex),
  };
}

// Month branch from the Sun's longitude. Each "節" month spans 30°, starting
// at 입춘 (315° → 寅/Tiger). Returns the branch index 0–11.
function monthBranchIndexFromLongitude(lambda: number): number {
  // 寅 卯 辰 巳 午 未 申 酉 戌 亥 子 丑  (branch indices)
  const order = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];
  const slot = Math.floor((mod(lambda + 45, 360)) / 30);
  return order[slot];
}

export function computeChart(birth: BirthData): SajuChart {
  const { year, month, day } = birth;
  const hour = birth.timeUnknown ? 12 : birth.hour;
  const minute = birth.timeUnknown ? 0 : birth.minute;

  // Birth instant in UT, as a fractional Julian Day.
  const localDecimalHour = hour + minute / 60;
  const jdUT = julianDay(year, month, day, localDecimalHour - birth.tzOffset);
  const lambda = solarLongitude(jdUT);

  // ── Year pillar ── changes at 입춘 (Sun at 315°), not Jan 1.
  const lichun = solarTermJD(year, 315);
  const sajuYear = jdUT >= lichun ? year : year - 1;
  const yearStemIndex = mod(sajuYear - 4, 10);
  const yearBranchIndex = mod(sajuYear - 4, 12);

  // ── Month pillar ── branch from solar term; stem via 월두법 (五虎遁).
  const monthBranchIndex = monthBranchIndexFromLongitude(lambda);
  const monthSeq = mod(monthBranchIndex - 2, 12); // 0 at 寅 month
  const monthStemIndex = mod((yearStemIndex % 5) * 2 + 2 + monthSeq, 10);

  // ── Day pillar ── continuous 60-day cycle. Day boundary at local midnight.
  const jdn = julianDayNumber(year, month, day);
  const dayGapja = mod(jdn + 49, 60); // 0 = 甲子
  const dayStemIndex = mod(dayGapja, 10);
  const dayBranchIndex = mod(dayGapja, 12);

  // ── Hour pillar ── branch from 2-hour blocks; stem via 시두법 (五鼠遁).
  let hourPillar: Pillar | null = null;
  if (!birth.timeUnknown) {
    const hourBranchIndex = mod(Math.floor((hour + 1) / 2), 12);
    const hourStemIndex = mod((dayStemIndex % 5) * 2 + hourBranchIndex, 10);
    hourPillar = pillar(hourStemIndex, hourBranchIndex, dayStemIndex, false);
  }

  const pillars = {
    year: pillar(yearStemIndex, yearBranchIndex, dayStemIndex, false),
    month: pillar(monthStemIndex, monthBranchIndex, dayStemIndex, false),
    day: pillar(dayStemIndex, dayBranchIndex, dayStemIndex, true),
    hour: hourPillar,
  };

  // ── Five-element tally across all stems & branches present ──
  const elementCounts: Record<Element, number> = {
    Wood: 0,
    Fire: 0,
    Earth: 0,
    Metal: 0,
    Water: 0,
  };
  const present: Pillar[] = [pillars.year, pillars.month, pillars.day];
  if (pillars.hour) present.push(pillars.hour);
  for (const p of present) {
    elementCounts[p.stem.element] += 1;
    elementCounts[p.branch.element] += 1;
  }

  let dominantElement: Element = 'Wood';
  let max = -1;
  for (const e of ELEMENTS) {
    if (elementCounts[e] > max) {
      max = elementCounts[e];
      dominantElement = e;
    }
  }
  const lackingElements = ELEMENTS.filter((e) => elementCounts[e] === 0);

  // ── Daeun (대운), Saeun (세운), Sinsal (신살) ──
  const daeun = computeDaeun({
    birthJDUT: jdUT,
    dayStemIndex,
    monthStemIndex,
    monthBranchIndex,
    yearStemIndex,
    gender: birth.gender,
  });
  const thisYear = new Date().getFullYear();
  const saeun = computeSaeun(dayStemIndex, thisYear - 1, 8); // last year → +6 years
  const currentSaeun = saeun.find((s) => s.year === thisYear) ?? saeun[0];
  const sinsal = computeSinsal({
    dayStemIndex,
    dayGapja,
    yearBranchIndex,
    dayBranchIndex,
    branches: [yearBranchIndex, monthBranchIndex, dayBranchIndex, hourPillar ? hourPillar.branchIndex : null],
  });

  return {
    birth,
    sajuYear,
    pillars,
    hasHour: !birth.timeUnknown,
    dayMaster: pillars.day.stem,
    zodiacAnimal: pillars.year.branch.animal,
    elementCounts,
    dominantElement,
    lackingElements,
    daeun,
    saeun,
    currentSaeun,
    sinsal,
  };
}

/** A compact human-readable label for a pillar, e.g. "Gyeong-O (庚午)". */
export function pillarLabel(p: Pillar): string {
  return `${p.stem.rom}-${p.branch.rom} (${p.stem.han}${p.branch.han})`;
}
