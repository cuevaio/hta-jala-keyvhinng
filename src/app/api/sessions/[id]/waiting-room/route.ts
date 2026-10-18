import { handle, ok } from "@/lib/http";
import { getServices } from "@/lib/services";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import { sessionIdParams } from "@/modules/sessions/schemas/session.schema";

export const GET = handle(
  async (
    _request: Request,
    ctx: RouteContext<"/api/sessions/[id]/waiting-room">,
  ) => {
    const { userId } = await requireIdentity();
    const { id } = sessionIdParams.parse(await ctx.params);
    const response = ok(
      await getServices().participation.waitingRoom(id, userId),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  },
);
