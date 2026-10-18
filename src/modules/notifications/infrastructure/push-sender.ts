import webpush from "web-push";
import { logger } from "@/lib/logger";
import type { PushSender } from "../domain/push";

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** Web Push adapter (VAPID). Push services answer 404/410 for browsers that unsubscribed. */
export function createWebPushSender(
  vapid: VapidKeys,
  send: typeof webpush.sendNotification = webpush.sendNotification,
): PushSender {
  return {
    async send(subscription, message) {
      try {
        await send(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(message),
          {
            vapidDetails: vapid,
            // A "group found" alert is useless once the group has expired.
            TTL: 600,
            urgency: "high",
            // Undelivered alerts for one room replace each other at the push service.
            // Topics allow 32 URL-safe characters: the room ID without hyphens.
            topic: message.tag.replace(/[^A-Za-z0-9]/g, "").slice(-32),
            timeout: 5000,
          },
        );
        return "sent";
      } catch (error) {
        const status =
          error instanceof webpush.WebPushError ? error.statusCode : null;
        return status === 404 || status === 410 ? "gone" : "failed";
      }
    },
  };
}

/** Development adapter: logs instead of delivering, like the log mailer. */
export function createLogPushSender(): PushSender {
  return {
    async send(_subscription, message) {
      if (process.env.NODE_ENV === "production")
        logger.warn("No VAPID keys configured; push was not delivered", {
          title: message.title,
        });
      else logger.info("Push (dev log sender)", { ...message });
      return "sent";
    },
  };
}
