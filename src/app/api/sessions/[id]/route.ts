import { getServices } from "@/lib/services";
import { handle, ok } from "@/lib/http";
import { sessionIdParams } from "@/modules/sessions/schemas/session.schema";

export const GET = handle(
  async (_request: Request, ctx: RouteContext<"/api/sessions/[id]">) => {
    const { id } = sessionIdParams.parse(await ctx.params);
    const session = await getServices().sessions.getById(id);
    const response = ok({ ...session, serverNow: new Date().toISOString() });
    response.headers.set("Cache-Control", "no-store");
    return response;
  },
);
