import { ApiError, assertSameOrigin, handle, ok } from "@/lib/http";
import { consume } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";
import { PartyError } from "@/modules/parties/domain/party-lifecycle";
import { partyCommandBody } from "@/modules/parties/schemas/party.schema";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import { sessionIdParams } from "@/modules/sessions/schemas/session.schema";

export const POST = handle(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { userId } = await requireIdentity();
    const { id } = sessionIdParams.parse(await ctx.params);
    const { action } = partyCommandBody.parse(await request.json());
    if (!(await consume(`party:${userId}`, 30, 60_000)))
      throw new ApiError(
        429,
        "rate_limited",
        "Espera un momento antes de volver a intentarlo.",
      );
    try {
      const response = ok(
        await getServices().parties.apply(id, userId, action),
      );
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch (error) {
      if (error instanceof PartyError)
        throw new ApiError(error.status, error.code, error.message);
      throw error;
    }
  },
);
