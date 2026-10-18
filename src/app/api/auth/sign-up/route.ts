import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { EmailTakenError } from "@/lib/errors";
import { consume } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";
import { signUpInput } from "@/modules/auth/schemas/auth.schema";
import { startSession } from "@/modules/participants/infrastructure/browser-identity";
import { clientKey } from "../client-key";

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  // Each sign-up costs a ~128 MiB scrypt run; cap them per client.
  if (!consume(`sign-up:${clientKey(request)}`, 10, 60 * 60 * 1000)) {
    throw new ApiError(
      429,
      "rate_limited",
      "Demasiados intentos. Espera un momento.",
    );
  }
  const input = signUpInput.parse(await readJson(request));
  try {
    const user = await getServices().auth.signUp(input);
    await startSession(user.userId);
    const response = ok(user, 201);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof EmailTakenError) {
      throw new ApiError(
        409,
        "email_taken",
        "Ya existe una cuenta con ese correo. Inicia sesión.",
      );
    }
    throw error;
  }
});
