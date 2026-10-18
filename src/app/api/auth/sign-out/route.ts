import { assertSameOrigin, handle, ok } from "@/lib/http";
import { logger } from "@/lib/logger";
import {
  endSession,
  readIdentity,
} from "@/modules/participants/infrastructure/browser-identity";

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const identity = await readIdentity();
  await endSession();
  logger.info("auth.sign_out", {
    userId: identity?.userId ?? null,
    hadSession: Boolean(identity),
  });
  return ok({ signedOut: true });
});
