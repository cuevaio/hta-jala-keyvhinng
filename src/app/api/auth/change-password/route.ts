import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { InvalidCredentialsError } from "@/lib/errors";
import { consume } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";
import { changePasswordInput } from "@/modules/auth/schemas/auth.schema";
import {
  requireIdentity,
  startSession,
} from "@/modules/participants/infrastructure/browser-identity";

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const { userId } = await requireIdentity();
  const input = changePasswordInput.parse(await readJson(request));
  if (!(await consume(`change-password:${userId}`, 5, 15 * 60_000)))
    throw new ApiError(
      429,
      "rate_limited",
      "Demasiados intentos. Intenta de nuevo en unos minutos.",
    );
  try {
    await getServices().auth.changePassword(
      userId,
      input.currentPassword,
      input.newPassword,
    );
  } catch (error) {
    if (error instanceof InvalidCredentialsError)
      throw new ApiError(
        400,
        "invalid_credentials",
        "La contraseña actual no es correcta.",
      );
    throw error;
  }
  // Every session was revoked, including this browser's; keep this one signed in.
  await startSession(userId);
  return ok({ changed: true });
});
