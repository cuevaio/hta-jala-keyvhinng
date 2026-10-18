import { getServices } from "@/lib/services";
import { handle, ok } from "@/lib/http";
import { listEventsQuery } from "@/modules/events/schemas/event.schema";

export const GET = handle(async (request: Request) => {
  const query = listEventsQuery.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  return ok(await getServices().events.list(query));
});
