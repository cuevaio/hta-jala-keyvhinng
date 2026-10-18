import { after } from "next/server";
import { ApiError, assertSameOrigin, handle, ok } from "@/lib/http";
import { getServices } from "@/lib/services";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import { sessionIdParams } from "@/modules/sessions/schemas/session.schema";
import { MatchingError } from "@/modules/matching/infrastructure/matching.repository";
import { RoutingError } from "@/modules/routing/domain/routing-provider";
import { consume } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const maxDuration = 60;
export const POST = handle(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { userId } = await requireIdentity();
    const { id } = sessionIdParams.parse(await ctx.params);
    if (!(await consume(`matching:${userId}`, 6, 60_000))) {
      throw new ApiError(
        429,
        "rate_limited",
        "Espera un momento antes de volver a buscar compañeros de viaje.",
      );
    }
    try {
      const services = getServices();
      const outcome = await services.matching.match(id, userId);
      if (outcome.createdPartyCount)
        after(() => services.roomEvents.matched(id, userId, outcome));
      const response = ok({
        createdPartyCount: outcome.createdPartyCount,
        alreadyMatched: outcome.alreadyMatched,
      });
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch (error) {
      if (error instanceof MatchingError)
        throw new ApiError(error.status, error.code, error.message);
      if (error instanceof RoutingError) {
        logger.warn("Matching routing failed", {
          sessionId: id,
          error: error.message,
        });
        throw new ApiError(
          503,
          "routing_unavailable",
          "No pudimos calcular las rutas. Sigues en la sala; intenta de nuevo.",
        );
      }
      throw error;
    }
  },
);
