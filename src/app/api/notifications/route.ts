import { z } from "zod";
import { assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { getServices } from "@/lib/services";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";

const readBody = z.union([
  z.object({ ids: z.array(z.uuid()).min(1).max(30) }).strict(),
  z.object({ all: z.literal(true) }).strict(),
]);

function privateResponse(data: unknown) {
  const response = ok(data);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const GET = handle(async () => {
  const { userId } = await requireIdentity();
  return privateResponse(await getServices().activity.list(userId));
});

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const { userId } = await requireIdentity();
  const body = readBody.parse(await readJson(request));
  await getServices().activity.markRead(
    userId,
    "ids" in body ? body.ids : undefined,
  );
  return privateResponse({ read: true });
});
