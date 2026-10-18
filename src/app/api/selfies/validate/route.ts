import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { consume } from "@/lib/rate-limit";
import { clientKey } from "@/app/api/auth/client-key";
import { joinSessionInput } from "@/modules/sessions/schemas/session.schema";
import { assertSelfieHasFace } from "@/modules/sessions/infrastructure/selfie-face";

// The ride form is available before sign-in. Validate without persisting the image.
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  if (!(await consume(`selfie:${clientKey(request)}`, 10, 60_000)))
    throw new ApiError(
      429,
      "rate_limited",
      "Demasiadas fotos. Espera un minuto e intenta de nuevo.",
    );
  const { selfieDataUrl } = joinSessionInput
    .pick({ selfieDataUrl: true })
    .parse(await readJson(request, 210_000));
  await assertSelfieHasFace(selfieDataUrl);
  return ok({ faceDetected: true });
});
