// Sanity checks for the Saju engine. Run: npm run test:saju
import { julianDayNumber, solarLongitude, julianDay, solarTermJD } from '../src/lib/saju/astronomy';
import { computeChart, pillarLabel } from '../src/lib/saju/calculator';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
}

// 1) Julian Day Number anchors (Meeus / standard references).
check('JDN 1900-01-01', julianDayNumber(1900, 1, 1), 2415021);
check('JDN 2000-01-01', julianDayNumber(2000, 1, 1), 2451545);

// 2) Day pillar: 1900-01-01 is the documented 甲戌 (Gap-Sul) day.
const c1900 = computeChart({ year: 1900, month: 1, day: 1, hour: 12, minute: 0, tzOffset: 9 });
check('1900-01-01 day pillar', pillarLabel(c1900.pillars.day).split(' ')[0], 'Gap-Sul');

// 3) Year pillar: 1984 is a 甲子 (Gap-Ja) year after 입춘.
const c1984 = computeChart({ year: 1984, month: 6, day: 15, hour: 12, minute: 0, tzOffset: 9 });
check('1984 saju year char', `${c1984.pillars.year.stem.han}${c1984.pillars.year.branch.han}`, '甲子');

// 4) 입춘 boundary: a birth in late January belongs to the *previous* saju year.
const cJan = computeChart({ year: 1990, month: 1, day: 20, hour: 12, minute: 0, tzOffset: 9 });
check('1990-01-20 saju year', cJan.sajuYear, 1989);
const cDec = computeChart({ year: 1990, month: 12, day: 20, hour: 12, minute: 0, tzOffset: 9 });
check('1990-12-20 saju year', cDec.sajuYear, 1990);

// 5) 입춘 of 1990 should fall in early February.
const lichun1990 = solarTermJD(1990, 315);
const lon = solarLongitude(lichun1990);
const ok = Math.abs(((lon - 315 + 540) % 360) - 180) < 0.05;
console.log(`${ok ? '✓' : '✗'} 입춘 1990 longitude ≈ 315° (got ${lon.toFixed(3)}°)`);
if (!ok) failures++;

// 6) Hour pillar branch mapping: 23:30 → 子 (Ja) hour.
const cNight = computeChart({ year: 2000, month: 5, day: 5, hour: 23, minute: 30, tzOffset: 9 });
check('23:30 hour branch', cNight.pillars.hour?.branch.rom, 'Ja');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
