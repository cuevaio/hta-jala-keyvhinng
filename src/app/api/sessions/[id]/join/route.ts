import { consume } from "@/lib/rate-limit";
import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { getServices } from "@/lib/services";
import { assertSelfieHasFace } from "@/modules/sessions/infrastructure/selfie-face";
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
    const input = joinSessionInput.parse(await readJson(request, 210_000));
    if (!(await consume(`selfie-join:${userId}`, 10, 60_000)))
      throw new ApiError(
        429,
        "rate_limited",
        "Demasiados intentos. Espera un minuto e intenta de nuevo.",
      );
    await assertSelfieHasFace(input.selfieDataUrl);
    return ok(await getServices().participation.join(id, userId, input));
  },
);
