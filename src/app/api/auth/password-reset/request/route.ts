import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { consume } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";
import { passwordResetRequestInput } from "@/modules/auth/schemas/auth.schema";
import { clientKey } from "../../client-key";

const HOUR = 60 * 60 * 1000;

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const { email } = passwordResetRequestInput.parse(await readJson(request));
  if (
    !(await consume(`reset:ip:${clientKey(request)}`, 10, HOUR)) ||
    !(await consume(`reset:email:${email}`, 3, HOUR))
  )
    throw new ApiError(
      429,
      "rate_limited",
      "Demasiados intentos. Intenta de nuevo más tarde.",
    );
  await getServices().auth.requestPasswordReset(email);
  // No email or account existence in logs: the answer is the same either way.
  logger.info("auth.password_reset_requested");
  // Identical answer whether or not the account exists.
  return ok({ requested: true });
});
