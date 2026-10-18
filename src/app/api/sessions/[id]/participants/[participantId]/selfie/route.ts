import { ApiError, handle } from "@/lib/http";
import { getServices } from "@/lib/services";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import { participantSelfieParams } from "@/modules/sessions/schemas/session.schema";

/** A party member's photo, visible only to members of the same party. */
export const GET = handle(
  async (
    _request: Request,
    ctx: RouteContext<"/api/sessions/[id]/participants/[participantId]/selfie">,
  ) => {
    const { userId } = await requireIdentity();
    const { id, participantId } = participantSelfieParams.parse(
      await ctx.params,
    );
    const dataUrl = await getServices().participation.selfieFor(
      id,
      userId,
      participantId,
    );
    // Same answer for "no photo" and "not your party", so membership does not leak.
    if (!dataUrl)
      throw new ApiError(404, "selfie_not_found", "Foto no disponible.");
    const bytes = Buffer.from(
      dataUrl.slice(dataUrl.indexOf(",") + 1),
      "base64",
    );
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        // The URL carries a version, so the private copy never goes stale.
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
);
