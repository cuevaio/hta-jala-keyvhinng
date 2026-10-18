import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { consume } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import {
  pushSubscriptionBody,
  pushUnsubscribeBody,
} from "@/modules/notifications/schemas/push.schema";

async function limit(userId: string) {
  if (!(await consume(`push:${userId}`, 10, 60_000)))
    throw new ApiError(
      429,
      "rate_limited",
      "Espera un momento antes de volver a intentarlo.",
    );
}

/** Registers this browser to receive the signed-in account's room notifications. */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const { userId } = await requireIdentity();
  const { endpoint, keys } = pushSubscriptionBody.parse(
    await readJson(request),
  );
  await limit(userId);
  await getServices().pushSubscriptions.save(userId, { endpoint, ...keys });
  return ok({ subscribed: true });
});

export const DELETE = handle(async (request: Request) => {
  assertSameOrigin(request);
  const { userId } = await requireIdentity();
  const { endpoint } = pushUnsubscribeBody.parse(await readJson(request));
  await limit(userId);
  await getServices().pushSubscriptions.remove(userId, endpoint);
  return ok({ subscribed: false });
});
