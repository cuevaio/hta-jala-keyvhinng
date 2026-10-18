import { lt, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db";
import { rateLimits } from "@/db/schema";

export interface RateLimiter {
  /** Counts one hit; false once `limit` hits were counted for `key` within `windowMs`. */
  hit(key: string, limit: number, windowMs: number): Promise<boolean>;
}

/**
 * Fixed window in Postgres, so the limit holds across instances and restarts.
 * One atomic upsert per hit; the row's window restarts when it has expired.
 */
export function createPostgresRateLimiter(db: Database): RateLimiter {
  return {
    async hit(key, limit, windowMs) {
      const resetAt = new Date(Date.now() + windowMs);
      const [row] = await db
        .insert(rateLimits)
        .values({ key, count: 1, resetAt })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: {
            count: sql`CASE WHEN ${rateLimits.resetAt} <= now() THEN 1 ELSE ${rateLimits.count} + 1 END`,
            resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= now() THEN excluded.reset_at ELSE ${rateLimits.resetAt} END`,
          },
        })
        .returning({ count: rateLimits.count });
      // Cheap janitor so abandoned keys do not accumulate.
      if (Math.random() < 0.01)
        await db.delete(rateLimits).where(lt(rateLimits.resetAt, new Date()));
      return row.count <= limit;
    },
  };
}

/** Per-process limiter for unit tests. */
export function createMemoryRateLimiter(): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    async hit(key, limit, windowMs) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= limit;
    },
  };
}

let limiter: RateLimiter | undefined;

/** Returns false when the caller exceeded the limit. Shared across instances. */
export function consume(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  limiter ??= createPostgresRateLimiter(getDb());
  return limiter.hit(key, limit, windowMs);
}

/** Test helper: switches to a fresh in-memory limiter so unit tests need no database. */
export function resetRateLimits() {
  limiter = createMemoryRateLimiter();
}
