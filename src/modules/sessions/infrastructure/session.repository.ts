import { and, asc, count, eq, type SQL } from "drizzle-orm";
import type { Database } from "@/db";
import { sessionParticipants, sessions } from "@/db/schema";
import type { SessionSummary } from "@/modules/sessions/domain/session";
import type { ListSessionsQuery } from "@/modules/sessions/schemas/session.schema";

export interface SessionRepository {
  list(query: ListSessionsQuery): Promise<SessionSummary[]>;
  findById(id: string): Promise<SessionSummary | null>;
}

export function createSessionRepository(db: Database): SessionRepository {
  const select = () =>
    db
      .select({
        id: sessions.id,
        eventId: sessions.eventId,
        name: sessions.name,
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
    async list({ eventId, status, limit }) {
      const filters: SQL[] = [];
      if (eventId) filters.push(eq(sessions.eventId, eventId));
      if (status) filters.push(eq(sessions.status, status));
      return select()
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(asc(sessions.opensAt))
        .limit(limit);
    },
    async findById(id) {
      const [row] = await select().where(eq(sessions.id, id)).limit(1);
      return row ?? null;
    },
  };
}
