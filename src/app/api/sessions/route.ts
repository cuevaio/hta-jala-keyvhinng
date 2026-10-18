import { getServices } from "@/lib/services";
import { handle, ok } from "@/lib/http";
import { listSessionsQuery } from "@/modules/sessions/schemas/session.schema";

export const GET = handle(async (request: Request) => {
  const query = listSessionsQuery.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  return ok(await getServices().sessions.list(query));
});
