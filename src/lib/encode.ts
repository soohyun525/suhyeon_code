// Compact URL-safe encoding of birth data for the compatibility share link.
// Browser-only (uses btoa/atob) — both call sites are client components.

export interface CompactBirth {
  name?: string;
  gender?: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timeUnknown?: boolean;
  tzOffset: number;
}

export function encodeBirth(b: CompactBirth): string {
  const compact = {
    n: b.name || undefined,
    g: b.gender || undefined,
    y: b.year,
    m: b.month,
    d: b.day,
    h: b.hour,
    i: b.minute,
    u: b.timeUnknown ? 1 : undefined,
    z: b.tzOffset,
  };
  const json = JSON.stringify(compact);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodeBirth(s: string): CompactBirth | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    const c = JSON.parse(json);
    if (typeof c.y !== 'number') return null;
    return {
      name: c.n,
      gender: c.g,
      year: c.y,
      month: c.m,
      day: c.d,
      hour: c.h ?? 12,
      minute: c.i ?? 0,
      timeUnknown: Boolean(c.u),
      tzOffset: c.z ?? 9,
    };
  } catch {
    return null;
  }
}
