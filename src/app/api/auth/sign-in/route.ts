import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { InvalidCredentialsError } from "@/lib/errors";
import { consume } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";
import { signInInput } from "@/modules/auth/schemas/auth.schema";
import { startSession } from "@/modules/participants/infrastructure/browser-identity";
import { clientKey } from "../client-key";

const WINDOW_MS = 15 * 60 * 1000;

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const input = signInInput.parse(await readJson(request));
  // Per account+client so one attacker cannot lock the real owner out, per client to
  // slow enumeration, and a looser per-account cap to bound distributed guessing.
  const ip = clientKey(request);
  if (
    !(await consume(`sign-in:pair:${input.email}:${ip}`, 8, WINDOW_MS)) ||
    !(await consume(`sign-in:ip:${ip}`, 30, WINDOW_MS)) ||
    !(await consume(`sign-in:email:${input.email}`, 40, WINDOW_MS))
  ) {
    throw new ApiError(
      429,
      "rate_limited",
      "Demasiados intentos. Intenta de nuevo en unos minutos.",
    );
  }
  try {
    const user = await getServices().auth.signIn(input);
    await startSession(user.userId);
    logger.info("auth.sign_in", { userId: user.userId });
    const response = ok(user);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      // One message for unknown email and wrong password.
      throw new ApiError(
        401,
        "invalid_credentials",
        "Correo o contraseña incorrectos.",
      );
    }
    throw error;
  }
});
