import { logger } from "@/lib/logger";
import type { PushMessage, PushSender } from "../domain/push";
import type { PushSubscriptionRepository } from "../infrastructure/push-subscription.repository";

/** Best-effort fan-out to every browser of the given accounts. Never throws. */
export function createNotificationService(
  subscriptions: Pick<
    PushSubscriptionRepository,
    "forUsers" | "removeEndpoints"
  >,
  sender: PushSender,
) {
  return {
    async notify(userIds: string[], message: PushMessage) {
      try {
        const targets = await subscriptions.forUsers([...new Set(userIds)]);
        if (!targets.length) return;
        const results = await Promise.all(
          targets.map((target) => sender.send(target, message)),
        );
        await subscriptions.removeEndpoints(
          targets
            .filter((_, i) => results[i] === "gone")
            .map((t) => t.endpoint),
        );
        // Counts only: endpoints identify a device and stay out of logs.
        logger.info("Push notifications sent", {
          tag: message.tag,
          sent: results.filter((r) => r === "sent").length,
          gone: results.filter((r) => r === "gone").length,
          failed: results.filter((r) => r === "failed").length,
        });
      } catch (error) {
        logger.error("Push notification fan-out failed", {
          tag: message.tag,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}
export type NotificationService = ReturnType<typeof createNotificationService>;
