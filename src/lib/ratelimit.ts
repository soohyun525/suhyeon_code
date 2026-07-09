// Best-effort in-memory rate limiter (per serverless instance). Good enough to
// blunt abuse of the LLM endpoints at launch; swap for Upstash/Redis when
// traffic justifies it (see README → Production checklist).

const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > 10_000) {
    Array.from(buckets.entries()).forEach(([k, v]) => {
      if (now > v.reset) buckets.delete(k);
    });
  }

  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (b.n >= limit) return false;
  b.n += 1;
  return true;
}

/** Client key from proxy headers (Vercel sets x-forwarded-for). */
export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : null) || req.headers.get('x-real-ip') || 'unknown';
}
