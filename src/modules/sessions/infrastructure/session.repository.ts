import { and, asc, count, eq, type SQL } from "drizzle-orm";
import type { Database } from "@/db";
import { sessionParticipants, sessions } from "@/db/schema";
import type {
  Session,
  SessionSummary,
} from "@/modules/sessions/domain/session";
import type { ListSessionsQuery } from "@/modules/sessions/schemas/session.schema";

type Row = Omit<Session, "pickup" | "destination"> & {
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  participantCount: number;
};

function toSummary({
  pickupLatitude,
  pickupLongitude,
  destinationLatitude,
  destinationLongitude,
  ...rest
}: Row): SessionSummary {
  return {
    ...rest,
    pickup: { latitude: pickupLatitude, longitude: pickupLongitude },
    destination: {
      latitude: destinationLatitude,
      longitude: destinationLongitude,
    },
  };
}

export interface SessionRepository {
  list(query: ListSessionsQuery): Promise<SessionSummary[]>;
  findById(id: string): Promise<SessionSummary | null>;
}

export function createSessionRepository(db: Database): SessionRepository {
  const select = () =>
    db
      .select({
        id: sessions.id,
        placeId: sessions.placeId,
        name: sessions.name,
        pickupLabel: sessions.pickupLabel,
        pickupLatitude: sessions.pickupLatitude,
        pickupLongitude: sessions.pickupLongitude,
        destinationLabel: sessions.destinationLabel,
        destinationLatitude: sessions.destinationLatitude,
        destinationLongitude: sessions.destinationLongitude,
        departsAt: sessions.departsAt,
        status: sessions.status,
        opensAt: sessions.opensAt,
        closesAt: sessions.closesAt,
        vehicleCapacity: sessions.vehicleCapacity,
        participantCount: count(sessionParticipants.id),
      })
      .from(sessions)
      .leftJoin(
        sessionParticipants,
        eq(sessionParticipants.sessionId, sessions.id),
      )
      .groupBy(sessions.id);

  return {
    async list({ placeId, status, limit }) {
      const filters: SQL[] = [];
      if (placeId) filters.push(eq(sessions.placeId, placeId));
      if (status) filters.push(eq(sessions.status, status));
      const rows = await select()
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(asc(sessions.departsAt))
        .limit(limit);
      return rows.map(toSummary);
    },
    async findById(id) {
      const [row] = await select().where(eq(sessions.id, id)).limit(1);
      return row ? toSummary(row) : null;
    },
  };
}
