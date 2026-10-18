import { assertSameOrigin, handle, ok } from "@/lib/http";
import { ensureIdentity } from "@/modules/participants/infrastructure/browser-identity";

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const response = ok(await ensureIdentity());
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});
