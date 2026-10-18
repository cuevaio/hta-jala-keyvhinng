import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db";
import {
  rideParties,
  ridePartyMembers,
  rides,
  sessionParticipants,
  sessions,
  users,
} from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import {
  decide,
  PartyError,
  type PartyCommand,
} from "../domain/party-lifecycle";

export function createPartyRepository(db: Database) {
  return {
    /**
     * Applies one lifecycle command. Takes the same session row lock as joins and
     * matching, so a leave cannot interleave with a match that reuses those people.
     */
    async apply(sessionId: string, userId: string, command: PartyCommand) {
      return db.transaction(async (tx) => {
        const [session] = await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.id, sessionId))
          .for("update");
        if (!session) throw new NotFoundError("Session");

        const [mine] = await tx
          .select({ partyId: ridePartyMembers.partyId })
          .from(ridePartyMembers)
          .innerJoin(rideParties, eq(rideParties.id, ridePartyMembers.partyId))
          .where(
            and(
              eq(ridePartyMembers.userId, userId),
              eq(rideParties.sessionId, sessionId),
            ),
          );
        if (!mine)
          throw new PartyError(
            404,
            "party_not_found",
            "Todavía no tienes un grupo de viaje en esta sala.",
          );

        const [party] = await tx
          .select({ id: rideParties.id, status: rideParties.status })
          .from(rideParties)
          .where(eq(rideParties.id, mine.partyId));
        const members = await tx
          .select({
            participantId: ridePartyMembers.participantId,
            userId: ridePartyMembers.userId,
            role: ridePartyMembers.role,
            status: ridePartyMembers.status,
          })
          .from(ridePartyMembers)
          .where(eq(ridePartyMembers.partyId, party.id));

        const decision = decide(
          { status: party.status, members },
          userId,
          command,
        );
        const now = new Date();
        const setParty = (status: typeof party.status) =>
          tx
            .update(rideParties)
            .set({ status, updatedAt: now })
            .where(eq(rideParties.id, party.id));

        switch (decision.kind) {
          case "noop":
            return { partyStatus: party.status };
          case "confirm": {
            await tx
              .update(ridePartyMembers)
              .set({ status: "confirmed", updatedAt: now })
              .where(
                and(
                  eq(ridePartyMembers.partyId, party.id),
                  eq(ridePartyMembers.userId, userId),
                ),
              );
            if (decision.partyStatus === "confirmed") {
              await setParty("confirmed");
              await tx
                .insert(rides)
                .values({ partyId: party.id })
                .onConflictDoNothing();
            }
            return { partyStatus: decision.partyStatus };
          }
          case "dissolve": {
            const others = members
              .filter((m) => m.userId !== userId)
              .map((m) => m.participantId);
            await setParty("cancelled");
            await tx
              .update(rides)
              .set({ status: "cancelled", updatedAt: now })
              .where(eq(rides.partyId, party.id));
            // The immutable route plan on the party row keeps the audit trail.
            await tx
              .delete(ridePartyMembers)
              .where(eq(ridePartyMembers.partyId, party.id));
            await tx
              .update(sessionParticipants)
              .set({ status: "withdrawn", updatedAt: now })
              .where(
                and(
                  eq(sessionParticipants.sessionId, sessionId),
                  eq(sessionParticipants.userId, userId),
                ),
              );
            if (others.length)
              await tx
                .update(sessionParticipants)
                .set({ status: "waiting", updatedAt: now })
                .where(inArray(sessionParticipants.id, others));
            return { partyStatus: "cancelled" as const };
          }
          case "start": {
            await setParty("in_progress");
            await tx
              .update(rides)
              .set({ status: "in_progress", startedAt: now, updatedAt: now })
              .where(eq(rides.partyId, party.id));
            return { partyStatus: "in_progress" as const };
          }
          case "complete": {
            await setParty("completed");
            await tx
              .update(rides)
              .set({ status: "completed", completedAt: now, updatedAt: now })
              .where(eq(rides.partyId, party.id));
            await tx
              .update(ridePartyMembers)
              .set({ status: "dropped_off", updatedAt: now })
              .where(eq(ridePartyMembers.partyId, party.id));
            await tx
              .update(users)
              .set({ completedRides: sql`${users.completedRides} + 1` })
              .where(
                inArray(
                  users.id,
                  members.map((m) => m.userId),
                ),
              );
            return { partyStatus: "completed" as const };
          }
        }
      });
    },
  };
}
export type PartyRepository = ReturnType<typeof createPartyRepository>;
