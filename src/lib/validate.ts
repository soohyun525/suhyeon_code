import type { BirthData } from './saju/calculator';

// Strict, defensive parsing of birth data coming from the client.
export function parseBirthData(body: any): BirthData {
  if (!body || typeof body !== 'object') throw new Error('Missing birth data.');

  const num = (v: any, name: string, min: number, max: number): number => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) {
      throw new Error(`Invalid ${name}.`);
    }
    return Math.trunc(n);
  };

  const year = num(body.year, 'year', 1900, 2100);
  const month = num(body.month, 'month', 1, 12);
  const day = num(body.day, 'day', 1, 31);
  const timeUnknown = Boolean(body.timeUnknown);
  const hour = timeUnknown ? 12 : num(body.hour, 'hour', 0, 23);
  const minute = timeUnknown ? 0 : num(body.minute ?? 0, 'minute', 0, 59);
  const tzOffset = Number(body.tzOffset);
  if (!Number.isFinite(tzOffset) || tzOffset < -12 || tzOffset > 14) {
    throw new Error('Invalid timezone offset.');
  }

  // Reject impossible calendar dates (e.g. Feb 30).
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    throw new Error('That date does not exist.');
  }

  const gender =
    body.gender === 'male' || body.gender === 'female' || body.gender === 'other'
      ? body.gender
      : undefined;

  return {
    name: typeof body.name === 'string' ? body.name.slice(0, 80) : undefined,
    gender,
    year,
    month,
    day,
    hour,
    minute,
    timeUnknown,
    tzOffset,
    birthplace: typeof body.birthplace === 'string' ? body.birthplace.slice(0, 120) : undefined,
  };
}
