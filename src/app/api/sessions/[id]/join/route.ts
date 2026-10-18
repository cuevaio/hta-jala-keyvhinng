import { assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { getServices } from "@/lib/services";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import {
  joinSessionInput,
  sessionIdParams,
} from "@/modules/sessions/schemas/session.schema";

export const POST = handle(
  async (request: Request, ctx: RouteContext<"/api/sessions/[id]/join">) => {
    assertSameOrigin(request);
    const { userId } = await requireIdentity();
    const { id } = sessionIdParams.parse(await ctx.params);
    const input = joinSessionInput.parse(await readJson(request));
    return ok(await getServices().participation.join(id, userId, input));
  },
);
