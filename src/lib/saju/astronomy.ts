// Lightweight astronomical helpers needed to build an accurate Manseryeok
// (만세력). The Four Pillars depend on solar terms (절기) — for example the
// Saju year changes at 입춘 (Lichun), not on January 1 — so we compute the
// Sun's apparent ecliptic longitude rather than relying on the civil month.
//
// The solar-longitude routine follows Meeus, "Astronomical Algorithms"
// (low-accuracy solar position, ch. 25), good to ~0.01°. That corresponds to
// a few minutes of time near a solar term — more than enough for a general
// reading. Births within a few minutes of a term boundary are inherently
// edge cases in any almanac.

/** Julian Day for a Gregorian calendar date + fractional hour (UT). */
export function julianDay(year: number, month: number, day: number, hourUT: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    B -
    1524.5 +
    hourUT / 24
  );
}

/**
 * Integer Julian Day Number for a civil date (used for the day pillar's
 * continuous 60-day sexagenary cycle). Anchored on 1900-01-01 = 甲戌 day.
 */
export function julianDayNumber(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/** Sun's apparent ecliptic longitude (degrees, 0–360) for a given Julian Day. */
export function solarLongitude(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mr = (M * Math.PI) / 180;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
    0.000289 * Math.sin(3 * Mr);
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  let lambda = trueLong - 0.00569 - 0.00478 * Math.sin((omega * Math.PI) / 180);
  lambda = ((lambda % 360) + 360) % 360;
  return lambda;
}

/**
 * Julian Day (UT) at which the Sun reaches `targetLongitude` (degrees) in a
 * given civil year. Used primarily to find 입춘 (target = 315°). Newton-style
 * iteration using the mean solar motion (~0.98565°/day).
 */
export function solarTermJD(year: number, targetLongitude: number): number {
  // Rough day-of-year guess from the target longitude (315° ≈ early Feb).
  let jd = julianDay(year, 1, 1, 0);
  for (let i = 0; i < 12; i++) {
    const current = solarLongitude(jd);
    let diff = targetLongitude - current;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    jd += diff / 0.98565;
  }
  return jd;
}
