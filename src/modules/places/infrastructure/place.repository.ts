import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { meetingPoints, places } from "@/db/schema";
import type {
  MeetingPoint,
  Place,
  PlaceWithMeetingPoints,
} from "@/modules/places/domain/place";
import type { ListPlacesQuery } from "@/modules/places/schemas/place.schema";

export interface PlaceRepository {
  list(query: ListPlacesQuery): Promise<Place[]>;
  findById(id: string): Promise<PlaceWithMeetingPoints | null>;
  findBySlug(slug: string): Promise<PlaceWithMeetingPoints | null>;
}

type PlaceRow = typeof places.$inferSelect;
type MeetingPointRow = typeof meetingPoints.$inferSelect;

const toPlace = (row: PlaceRow): Place => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  kind: row.kind,
  description: row.description,
  address: row.address,
  location: { latitude: row.latitude, longitude: row.longitude },
  status: row.status,
  isFictional: row.isFictional,
});

const toMeetingPoint = (row: MeetingPointRow): MeetingPoint => ({
  id: row.id,
  placeId: row.placeId,
  name: row.name,
  description: row.description,
  location: { latitude: row.latitude, longitude: row.longitude },
});

export function createPlaceRepository(db: Database): PlaceRepository {
  async function withMeetingPoints(row: PlaceRow | undefined) {
    if (!row) return null;
    const points = await db
      .select()
      .from(meetingPoints)
      .where(eq(meetingPoints.placeId, row.id))
      .orderBy(asc(meetingPoints.createdAt), asc(meetingPoints.id));
    return { ...toPlace(row), meetingPoints: points.map(toMeetingPoint) };
  }

  return {
    async list({ status, kind, limit }) {
      const rows = await db
        .select()
        .from(places)
        .where(
          and(
            status ? eq(places.status, status) : undefined,
            kind ? eq(places.kind, kind) : undefined,
          ),
        )
        .orderBy(asc(places.name))
        .limit(limit);
      return rows.map(toPlace);
    },
    async findById(id) {
      const [row] = await db
        .select()
        .from(places)
        .where(eq(places.id, id))
        .limit(1);
      return withMeetingPoints(row);
    },
    async findBySlug(slug) {
      const [row] = await db
        .select()
        .from(places)
        .where(eq(places.slug, slug))
        .limit(1);
      return withMeetingPoints(row);
    },
  };
}
