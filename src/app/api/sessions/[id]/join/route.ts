import { after } from "next/server";
import { logger } from "@/lib/logger";
import { consume } from "@/lib/rate-limit";
import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { getServices } from "@/lib/services";
import { assertSelfieHasFace } from "@/modules/sessions/infrastructure/selfie-face";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import {
  joinSessionInput,
  sessionIdParams,
} from "@/modules/sessions/schemas/session.schema";

// Room for background matching, which routes the group after the response is sent.
export const maxDuration = 60;
export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/sessions/[id]/join">) => {
    assertSameOrigin(request);
    const { userId } = await requireIdentity();
    const { id } = sessionIdParams.parse(await ctx.params);
    const input = joinSessionInput.parse(await readJson(request, 210_000));
    if (!(await consume(`selfie-join:${userId}`, 10, 60_000)))
      throw new ApiError(
        429,
        "rate_limited",
        "Demasiados intentos. Espera un minuto e intenta de nuevo.",
      );
    await assertSelfieHasFace(input.selfieDataUrl);
    const services = getServices();
    const participant = await services.participation.join(id, userId, input);
    logger.info("room.join", {
      sessionId: id,
      userId,
      participantId: participant.id,
      delegatePreference: input.delegatePreference,
    });
    after(() => services.roomEvents.joined(id, userId));
    return ok(participant);
  },
);
