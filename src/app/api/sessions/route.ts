import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import { getServices } from "@/lib/services";
import { assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import {
  createSessionInput,
  listSessionsQuery,
} from "@/modules/sessions/schemas/session.schema";

export const GET = handle(async (request: Request) => {
  const query = listSessionsQuery.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  return ok(await getServices().sessions.list(query));
});

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  await requireIdentity();
  const { eventId } = createSessionInput.parse(await readJson(request));
  return ok(await getServices().participation.openForEvent(eventId));
});
