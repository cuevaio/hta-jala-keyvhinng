/**
 * Fixed-window in-memory limiter. Per-process only: fine for a single-instance demo,
 * but behind several instances use a shared store (Redis/Postgres) instead.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

/** Returns false once `limit` hits were counted for `key` within `windowMs`. */
export function consume(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function resetRateLimits() {
  hits.clear();
}
