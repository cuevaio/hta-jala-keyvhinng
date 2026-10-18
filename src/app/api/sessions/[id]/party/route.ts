import { after } from "next/server";
import { logger } from "@/lib/logger";
import { ApiError, assertSameOrigin, handle, ok } from "@/lib/http";
import { consume } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";
import { PartyError } from "@/modules/parties/domain/party-lifecycle";
import { partyCommandBody } from "@/modules/parties/schemas/party.schema";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import { sessionIdParams } from "@/modules/sessions/schemas/session.schema";

// Room for re-matching a dissolved party after the response is sent.
export const maxDuration = 60;
export const POST = handle(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { userId } = await requireIdentity();
    const { id } = sessionIdParams.parse(await ctx.params);
    const { action, fareMinor } = partyCommandBody.parse(await request.json());
    if (!(await consume(`party:${userId}`, 30, 60_000)))
      throw new ApiError(
        429,
        "rate_limited",
        "Espera un momento antes de volver a intentarlo.",
      );
    try {
      const services = getServices();
      for (const expired of await services.parties.sweep(id))
        after(() => services.roomEvents.partyChanged(id, expired));
      const { partyStatus, event } = await services.parties.apply(
        id,
        userId,
        action,
        fareMinor,
      );
      logger.info(`party.${action}`, {
        sessionId: id,
        userId,
        partyStatus,
        event: event?.kind ?? null,
        ...(action === "set_fare" && { fareMinor }),
      });
      if (event) after(() => services.roomEvents.partyChanged(id, event));
      const response = ok({ partyStatus });
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch (error) {
      if (error instanceof PartyError)
        throw new ApiError(error.status, error.code, error.message);
      throw error;
    }
  },
);
