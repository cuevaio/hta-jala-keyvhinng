import { after, type NextRequest } from "next/server";
import { handle, ok } from "@/lib/http";
import { getServices } from "@/lib/services";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import {
  roomRevisionQuery,
  sessionIdParams,
} from "@/modules/sessions/schemas/session.schema";

export const GET = handle(
  async (
    request: NextRequest,
    ctx: RouteContext<"/api/sessions/[id]/waiting-room">,
  ) => {
    const { userId } = await requireIdentity();
    const { id } = sessionIdParams.parse(await ctx.params);
    const { rev } = roomRevisionQuery.parse({
      rev: request.nextUrl.searchParams.get("rev") ?? undefined,
    });
    const { participation, parties, roomEvents } = getServices();
    // Deadlines pass without anyone writing, so polls are where expiry is noticed.
    const expired = await parties.sweep(id);
    for (const event of expired)
      after(() => roomEvents.partyChanged(id, event));
    // A poll that already has the current revision gets the clock and nothing else.
    const current =
      rev === undefined ? null : await participation.roomRevision(id, userId);
    const response = ok(
      current !== null && current === rev
        ? {
            unchanged: true as const,
            revision: current,
            serverNow: new Date().toISOString(),
          }
        : await participation.waitingRoom(id, userId),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  },
);
