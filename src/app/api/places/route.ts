import { getServices } from "@/lib/services";
import { handle, ok } from "@/lib/http";
import { listPlacesQuery } from "@/modules/places/schemas/place.schema";

export const GET = handle(async (request: Request) => {
  const query = listPlacesQuery.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  return ok(await getServices().places.list(query));
});
