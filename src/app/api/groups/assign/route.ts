import { after } from "next/server";
import { consume } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { getServices } from "@/lib/services";
import { assertSelfieHasFace } from "@/modules/sessions/infrastructure/selfie-face";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import { createGroupInput } from "@/modules/sessions/schemas/session.schema";

// Room for background matching, which routes the group after the response is sent.
export const maxDuration = 60;

/** Puts the caller in the best open group for their ride, or starts one (ADR 0010). */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const { userId } = await requireIdentity();
  const input = createGroupInput.parse(await readJson(request, 210_000));
  if (!(await consume(`selfie-join:${userId}`, 10, 60_000)))
    throw new ApiError(
      429,
      "rate_limited",
      "Demasiados intentos. Espera un minuto e intenta de nuevo.",
    );
  await assertSelfieHasFace(input.selfieDataUrl);
  const services = getServices();
  const { session, created, candidates } = await services.participation.assign(
    userId,
    input,
  );
  logger.info("room.assign", {
    sessionId: session.id,
    userId,
    outcome: created ? "created" : "joined",
    candidates,
    departInMinutes: input.departInMinutes,
    delegatePreference: input.delegatePreference,
  });
  // Someone new in an existing room may complete a group right away.
  if (!created) after(() => services.roomEvents.joined(session.id, userId));
  return ok({ id: session.id, created });
});
