import { after } from "next/server";
import { z } from "zod";
import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { consume } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import { SEAT_ACTIONS } from "@/modules/sessions/infrastructure/participation.repository";
import { sessionIdParams } from "@/modules/sessions/schemas/session.schema";

const seatCommand = z.object({ action: z.enum(SEAT_ACTIONS) });

// Room for matching after someone volunteers to book, once the response is sent.
export const maxDuration = 60;
/** A waiting person leaves the room, or offers to book the taxi so a group can form. */
export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/sessions/[id]/seat">) => {
    assertSameOrigin(request);
    const { userId } = await requireIdentity();
    const { id } = sessionIdParams.parse(await ctx.params);
    const { action } = seatCommand.parse(await readJson(request));
    if (!(await consume(`seat:${userId}`, 20, 60_000)))
      throw new ApiError(
        429,
        "rate_limited",
        "Espera un momento antes de volver a intentarlo.",
      );
    const services = getServices();
    const { changed } = await services.participation.updateSeat(
      id,
      userId,
      action,
    );
    logger.info(`room.${action}`, { sessionId: id, userId, changed });
    // A new booker can complete a group that was waiting for one.
    if (action === "offer_to_book" && changed)
      after(() => services.roomEvents.joined(id, userId));
    const response = ok({ changed });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  },
);
