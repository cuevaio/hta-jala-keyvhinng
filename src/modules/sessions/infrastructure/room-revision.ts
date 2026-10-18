import { inArray, eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { sessions } from "@/db/schema";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Marks a room as changed so polling members fetch it again. Every write a member can
 * see calls this in the same transaction. It takes the session row lock, so callers that
 * also lock a party row must call it first (session, then party) to avoid deadlocks.
 */
export async function bumpRoomRevision(tx: Tx, sessionId: string) {
  await tx
    .update(sessions)
    .set({ revision: sql`${sessions.revision} + 1` })
    .where(eq(sessions.id, sessionId));
}

/**
 * Bumps rooms this transaction changed without holding their lock. It skips rooms
 * another writer holds instead of waiting, because waiting on a second session row
 * could deadlock. That writer bumps the room itself; in the rare case its bump commits
 * first, members catch up on their next periodic full refresh.
 */
export async function bumpOtherRoomRevisions(tx: Tx, sessionIds: string[]) {
  if (!sessionIds.length) return;
  const unlocked = tx
    .select({ id: sessions.id })
    .from(sessions)
    .where(inArray(sessions.id, sessionIds))
    .for("update", { skipLocked: true });
  await tx
    .update(sessions)
    .set({ revision: sql`${sessions.revision} + 1` })
    .where(inArray(sessions.id, unlocked));
}
