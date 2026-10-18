import { and, asc, eq, gt, lte } from "drizzle-orm";
import type { Database } from "@/db";
import {
  places,
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
      "Esta sesión no está abierta. Vuelve al lugar para elegir otra.",
    );
  }
}

export function createParticipationRepository(db: Database) {
  return {
    /** Place lock serializes creation; simultaneous visitors reuse the same open pool. */
    async openForPlace(placeId: string) {
      return db.transaction(async (tx) => {
        const [place] = await tx
          .select()
          .from(places)
          .where(eq(places.id, placeId))
          .for("update");
        if (!place) throw new NotFoundError("Place");
        if (place.status !== "active") {
          throw new ApiError(
            409,
            "place_unavailable",
            "Este lugar ya no admite salidas.",
          );
        }
        const now = new Date();
        const [existing] = await tx
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.placeId, placeId),
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
            placeId,
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
        const [place] = await tx
          .select()
          .from(places)
          .where(eq(places.id, session.placeId));
        if (place.status !== "active")
          throw new ApiError(
            409,
            "place_unavailable",
            "Este lugar ya no admite pasajeros.",
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
          const [place] = await tx
            .select({ status: places.status })
            .from(places)
            .where(eq(places.id, session.placeId));
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
          // Same for every member, so group members always see an identical party.
          const members = party
            ? await tx
                .select({
                  participantId: ridePartyMembers.participantId,
                  status: ridePartyMembers.status,
                })
                .from(ridePartyMembers)
                .where(eq(ridePartyMembers.partyId, party.id))
                .orderBy(asc(ridePartyMembers.dropOffOrder))
            : [];
          const now = new Date();
          return {
            session,
            me,
            party: party ? { ...party, members } : null,
            participants,
            acceptingJoins:
              place.status === "active" &&
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
