import type { PlaceRepository } from "@/modules/places/infrastructure/place.repository";
import type { ListPlacesQuery } from "@/modules/places/schemas/place.schema";
import { NotFoundError } from "@/lib/errors";

export function createPlaceService(repo: PlaceRepository) {
  return {
    list: (query: ListPlacesQuery) => repo.list(query),
    async getById(id: string) {
      const place = await repo.findById(id);
      if (!place) throw new NotFoundError("Place");
      return place;
    },
  };
}
export type PlaceService = ReturnType<typeof createPlaceService>;
