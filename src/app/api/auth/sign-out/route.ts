import { assertSameOrigin, handle, ok } from "@/lib/http";
import { endSession } from "@/modules/participants/infrastructure/browser-identity";

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  await endSession();
  return ok({ signedOut: true });
});
