import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import type { PushSubscriptionKeys } from "../domain/push";

export function createPushSubscriptionRepository(db: Database) {
  return {
    /** A browser belongs to whoever subscribed it last, so a shared device follows sign-ins. */
    async save(userId: string, subscription: PushSubscriptionKeys) {
      await db
        .insert(pushSubscriptions)
        .values({ userId, ...subscription })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            userId,
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        });
    },
    async remove(userId: string, endpoint: string) {
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, userId),
            eq(pushSubscriptions.endpoint, endpoint),
          ),
        );
    },
    async forUsers(userIds: string[]): Promise<PushSubscriptionKeys[]> {
      if (!userIds.length) return [];
      return db
        .select({
          endpoint: pushSubscriptions.endpoint,
          p256dh: pushSubscriptions.p256dh,
          auth: pushSubscriptions.auth,
        })
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, userIds));
    },
    async removeEndpoints(endpoints: string[]) {
      if (!endpoints.length) return;
      await db
        .delete(pushSubscriptions)
        .where(inArray(pushSubscriptions.endpoint, endpoints));
    },
  };
}
export type PushSubscriptionRepository = ReturnType<
  typeof createPushSubscriptionRepository
>;
