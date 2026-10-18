import { assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { getServices } from "@/lib/services";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import { createGroupInput } from "@/modules/sessions/schemas/session.schema";

/** Starts a new ride group and joins the caller to it. */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const { userId } = await requireIdentity();
  const input = createGroupInput.parse(await readJson(request));
  return ok(await getServices().participation.createGroup(userId, input));
});
