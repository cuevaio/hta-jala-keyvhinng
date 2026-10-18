import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { InvalidResetTokenError } from "@/lib/errors";
import { consume } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";
import { passwordResetConfirmInput } from "@/modules/auth/schemas/auth.schema";
import { clientKey } from "../../client-key";

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const input = passwordResetConfirmInput.parse(await readJson(request));
  if (!(await consume(`reset-confirm:${clientKey(request)}`, 10, 60 * 60_000)))
    throw new ApiError(
      429,
      "rate_limited",
      "Demasiados intentos. Intenta de nuevo más tarde.",
    );
  try {
    await getServices().auth.resetPassword(input.token, input.password);
    logger.info("auth.password_reset");
    return ok({ reset: true });
  } catch (error) {
    if (error instanceof InvalidResetTokenError)
      throw new ApiError(
        400,
        "invalid_token",
        "El enlace venció o ya se usó. Pide uno nuevo.",
      );
    throw error;
  }
});
