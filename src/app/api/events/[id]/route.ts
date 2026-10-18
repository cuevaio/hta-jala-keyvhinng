import { getServices } from "@/lib/services";
import { handle, ok } from "@/lib/http";
import { eventIdParams } from "@/modules/events/schemas/event.schema";

export const GET = handle(
  async (_request: Request, ctx: RouteContext<"/api/events/[id]">) => {
    const { id } = eventIdParams.parse(await ctx.params);
    return ok(await getServices().events.getById(id));
  },
);
