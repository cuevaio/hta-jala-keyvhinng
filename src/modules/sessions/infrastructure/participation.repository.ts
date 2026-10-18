import { and, asc, eq, gt, lte } from "drizzle-orm";
import type { Database } from "@/db";
import {
  events,
  rideParties,
  ridePartyMembers,
  sessionParticipants,
  sessions,
  users,
} from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import { ApiError } from "@/lib/http";
import type { JoinSessionInput } from "../schemas/session.schema";

function assertOpen(session: typeof sessions.$inferSelect, now: Date) {
  if (
    session.status !== "open" ||
    session.opensAt > now ||
    session.closesAt <= now
  ) {
    throw new ApiError(
      409,
      "session_unavailable",
      "Esta sesión no está abierta. Vuelve al evento para elegir otra.",
    );
  }
}

export function createParticipationRepository(db: Database) {
  return {
    /** Event lock serializes creation; simultaneous visitors reuse the same open pool. */
    async openForEvent(eventId: string) {
      return db.transaction(async (tx) => {
        const [event] = await tx
          .select()
          .from(events)
          .where(eq(events.id, eventId))
          .for("update");
        if (!event) throw new NotFoundError("Event");
        if (event.status === "cancelled" || event.status === "ended") {
          throw new ApiError(
            409,
            "event_unavailable",
            "El evento ya no admite sesiones.",
          );
        }
        const now = new Date();
        const [existing] = await tx
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.eventId, eventId),
              eq(sessions.status, "open"),
              lte(sessions.opensAt, now),
              gt(sessions.closesAt, now),
            ),
          )
          .orderBy(asc(sessions.opensAt))
          .limit(1);
        if (existing) return existing;
        const [created] = await tx
          .insert(sessions)
          .values({
            eventId,
            name: "Salida compartida",
            opensAt: now,
            closesAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
            vehicleCapacity: 3,
          })
          .returning();
        return created;
      });
    },
    async join(sessionId: string, userId: string, input: JoinSessionInput) {
      return db.transaction(async (tx) => {
        // All join and matching commits serialize on this same session row.
        const [session] = await tx
          .select()
          .from(sessions)
          .where(eq(sessions.id, sessionId))
          .for("update");
        if (!session) throw new NotFoundError("Session");
        assertOpen(session, new Date());
        const [event] = await tx
          .select()
          .from(events)
          .where(eq(events.id, session.eventId));
        if (event.status === "ended" || event.status === "cancelled")
          throw new ApiError(
            409,
            "event_unavailable",
            "El evento ya no admite pasajeros.",
          );
        const [existing] = await tx
          .select()
          .from(sessionParticipants)
          .where(
            and(
              eq(sessionParticipants.sessionId, sessionId),
              eq(sessionParticipants.userId, userId),
            ),
          );
        if (existing?.status === "matched")
          throw new ApiError(
            409,
            "already_matched",
            "Ya perteneces a un grupo.",
          );
        await tx
          .update(users)
          .set({ displayName: input.displayName })
          .where(eq(users.id, userId));
        const values = {
          destinationLabel: input.destinationLabel,
          latitude: input.latitude,
          longitude: input.longitude,
          delegatePreference: input.delegatePreference,
          status: "waiting" as const,
        };
        const [participant] = await tx
          .insert(sessionParticipants)
          .values({ sessionId, userId, ...values })
          .onConflictDoUpdate({
            target: [sessionParticipants.sessionId, sessionParticipants.userId],
            set: values,
          })
          .returning();
        return participant;
      });
    },
    async waitingRoom(sessionId: string, userId: string) {
      return db.transaction(
        async (tx) => {
          const [session] = await tx
            .select()
            .from(sessions)
            .where(eq(sessions.id, sessionId));
          if (!session) throw new NotFoundError("Session");
          const [me] = await tx
            .select()
            .from(sessionParticipants)
            .where(
              and(
                eq(sessionParticipants.sessionId, sessionId),
                eq(sessionParticipants.userId, userId),
              ),
            );
          if (!me || me.status === "withdrawn")
            throw new ApiError(
              403,
              "membership_required",
              "Únete a esta sesión para ver a sus participantes.",
            );
          const participants = await tx
            .select({
              id: sessionParticipants.id,
              displayName: users.displayName,
              delegatePreference: sessionParticipants.delegatePreference,
              status: sessionParticipants.status,
            })
            .from(sessionParticipants)
            .innerJoin(users, eq(users.id, sessionParticipants.userId))
            .where(
              and(
                eq(sessionParticipants.sessionId, sessionId),
                eq(sessionParticipants.status, "waiting"),
              ),
            )
            .orderBy(asc(sessionParticipants.createdAt));
          const [event] = await tx
            .select({ status: events.status })
            .from(events)
            .where(eq(events.id, session.eventId));
          const [party] = await tx
            .select({
              id: rideParties.id,
              status: rideParties.status,
              plan: rideParties.routePlan,
            })
            .from(ridePartyMembers)
            .innerJoin(
              rideParties,
              eq(rideParties.id, ridePartyMembers.partyId),
            )
            .where(
              and(
                eq(ridePartyMembers.participantId, me.id),
                eq(rideParties.sessionId, sessionId),
              ),
            );
          const now = new Date();
          return {
            session,
            me,
            party: party ?? null,
            participants,
            acceptingJoins:
              event.status !== "ended" &&
              event.status !== "cancelled" &&
              session.status === "open" &&
              session.opensAt <= now &&
              session.closesAt > now,
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
export type WaitingRoom = Awaited<
  ReturnType<ReturnType<typeof createParticipationRepository>["waitingRoom"]>
>;
