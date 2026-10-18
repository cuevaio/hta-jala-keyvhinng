import { handle, ok } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getServices } from "@/lib/services";
import { searchGroupsQuery } from "@/modules/sessions/schemas/session.schema";

/** Open groups that fit a ride (where you are, where you go, when). Public. */
export const GET = handle(async (request: Request) => {
  const query = searchGroupsQuery.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const groups = await getServices().participation.search(query);
  // Counts only: the query holds where someone is and where they are going.
  logger.info("room.search", {
    departInMinutes: query.depart,
    resultCount: groups.length,
  });
  return ok(groups);
});
