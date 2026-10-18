import { asc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { events, meetingPoints } from "@/db/schema";
import type {
  Event,
  EventWithMeetingPoints,
  MeetingPoint,
} from "@/modules/events/domain/event";
import type { ListEventsQuery } from "@/modules/events/schemas/event.schema";

export interface EventRepository {
  list(query: ListEventsQuery): Promise<Event[]>;
  findById(id: string): Promise<EventWithMeetingPoints | null>;
  findBySlug(slug: string): Promise<EventWithMeetingPoints | null>;
}

type EventRow = typeof events.$inferSelect;
type MeetingPointRow = typeof meetingPoints.$inferSelect;

const toEvent = (row: EventRow): Event => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  venueName: row.venueName,
  venue: { latitude: row.venueLatitude, longitude: row.venueLongitude },
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  status: row.status,
  isFictional: row.isFictional,
});

const toMeetingPoint = (row: MeetingPointRow): MeetingPoint => ({
  id: row.id,
  eventId: row.eventId,
  name: row.name,
  description: row.description,
  location: { latitude: row.latitude, longitude: row.longitude },
});

export function createEventRepository(db: Database): EventRepository {
  async function withMeetingPoints(row: EventRow | undefined) {
    if (!row) return null;
    const points = await db
      .select()
      .from(meetingPoints)
      .where(eq(meetingPoints.eventId, row.id))
      .orderBy(asc(meetingPoints.name));
    return { ...toEvent(row), meetingPoints: points.map(toMeetingPoint) };
  }

  return {
    async list({ status, limit }) {
      const rows = await db
        .select()
        .from(events)
        .where(status ? eq(events.status, status) : undefined)
        .orderBy(asc(events.startsAt))
        .limit(limit);
      return rows.map(toEvent);
    },
    async findById(id) {
      const [row] = await db
        .select()
        .from(events)
        .where(eq(events.id, id))
        .limit(1);
      return withMeetingPoints(row);
    },
    async findBySlug(slug) {
      const [row] = await db
        .select()
        .from(events)
        .where(eq(events.slug, slug))
        .limit(1);
      return withMeetingPoints(row);
    },
  };
}
