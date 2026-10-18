import { z } from "zod";
import { PLACE_KINDS, PLACE_STATUSES } from "@/modules/places/domain/place";

export const placeIdParams = z.object({ id: z.uuid() });

export const listPlacesQuery = z.object({
  status: z.enum(PLACE_STATUSES).optional(),
  kind: z.enum(PLACE_KINDS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListPlacesQuery = z.infer<typeof listPlacesQuery>;
