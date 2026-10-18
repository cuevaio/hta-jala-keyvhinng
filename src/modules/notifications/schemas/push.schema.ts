import { z } from "zod";
import { isKnownPushEndpoint } from "../domain/push";

const endpoint = z
  .string()
  .max(2048)
  .refine(isKnownPushEndpoint, "Servicio de notificaciones no admitido.");
const key = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+={0,2}$/);

/** The JSON form of a browser PushSubscription (`subscription.toJSON()`). */
export const pushSubscriptionBody = z.object({
  endpoint,
  keys: z.object({ p256dh: key, auth: key }),
});

export const pushUnsubscribeBody = z.object({ endpoint: z.string().max(2048) });
