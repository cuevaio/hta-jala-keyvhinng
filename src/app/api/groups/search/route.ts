import { handle, ok } from "@/lib/http";
import { getServices } from "@/lib/services";
import { searchGroupsQuery } from "@/modules/sessions/schemas/session.schema";

/** Open groups that fit a ride (where you are, where you go, when). Public. */
export const GET = handle(async (request: Request) => {
  const query = searchGroupsQuery.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  return ok(await getServices().participation.search(query));
});
