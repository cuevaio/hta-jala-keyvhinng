import { consume } from "@/lib/rate-limit";
import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { getServices } from "@/lib/services";
import { assertSelfieHasFace } from "@/modules/sessions/infrastructure/selfie-face";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import { createGroupInput } from "@/modules/sessions/schemas/session.schema";

/** Starts a new ride group and joins the caller to it. */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const { userId } = await requireIdentity();
  const input = createGroupInput.parse(await readJson(request, 210_000));
  if (!(await consume(`selfie-join:${userId}`, 10, 60_000)))
    throw new ApiError(
      429,
      "rate_limited",
      "Demasiados intentos. Espera un minuto e intenta de nuevo.",
    );
  await assertSelfieHasFace(input.selfieDataUrl);
  return ok(await getServices().participation.createGroup(userId, input));
});
