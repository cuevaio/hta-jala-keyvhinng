import { getServices } from "@/lib/services";
import { handle, ok } from "@/lib/http";
import { placeIdParams } from "@/modules/places/schemas/place.schema";

export const GET = handle(
  async (_request: Request, ctx: RouteContext<"/api/places/[id]">) => {
    const { id } = placeIdParams.parse(await ctx.params);
    return ok(await getServices().places.getById(id));
  },
);
