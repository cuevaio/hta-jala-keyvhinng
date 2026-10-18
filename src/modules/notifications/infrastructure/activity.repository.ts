import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { notificationActivity } from "@/db/schema";
import type { ActivityFeed, ActivityKind } from "../domain/activity";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Call only in the ride write's transaction, after deciding a real transition. */
export async function recordActivity(
  tx: Tx,
  userIds: string[],
  sessionId: string,
  kind: ActivityKind,
) {
  const recipients = [...new Set(userIds)];
  if (!recipients.length) return;
  await tx
    .insert(notificationActivity)
    .values(recipients.map((userId) => ({ userId, sessionId, kind })));
}

export function createActivityRepository(db: Database) {
  return {
    async list(userId: string): Promise<ActivityFeed> {
      const [items, [unread]] = await Promise.all([
        db
          .select({
            id: notificationActivity.id,
            kind: notificationActivity.kind,
            sessionId: notificationActivity.sessionId,
            createdAt: notificationActivity.createdAt,
            readAt: notificationActivity.readAt,
          })
          .from(notificationActivity)
          .where(eq(notificationActivity.userId, userId))
          .orderBy(
            desc(notificationActivity.createdAt),
            desc(notificationActivity.id),
          )
          .limit(30),
        db
          .select({ count: count() })
          .from(notificationActivity)
          .where(
            and(
              eq(notificationActivity.userId, userId),
              isNull(notificationActivity.readAt),
            ),
          ),
      ]);
      return {
        items: items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          readAt: item.readAt?.toISOString() ?? null,
        })),
        unreadCount: unread.count,
      };
    },

    /** Explicit IDs mark selected items; omitting IDs marks all unread for this account. */
    async markRead(userId: string, ids?: string[]) {
      if (ids && !ids.length) return;
      await db
        .update(notificationActivity)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notificationActivity.userId, userId),
            ids ? inArray(notificationActivity.id, ids) : undefined,
            isNull(notificationActivity.readAt),
          ),
        );
    },
  };
}
