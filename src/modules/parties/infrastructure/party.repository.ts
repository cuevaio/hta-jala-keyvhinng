import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db";
import {
  feeLedgerEntries,
  rideParties,
  ridePartyMembers,
  rides,
  sessionParticipants,
  sessions,
  users,
} from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { calculatePlatformFee } from "@/modules/payments/domain/fees";
import { bumpRoomRevision } from "@/modules/sessions/infrastructure/room-revision";
import { missedDeadline } from "./party-deadlines";
import {
  confirmDeadline,
  decide,
  expiryOf,
  PartyError,
  startDeadline,
  type PartyCommand,
  type PartyEvent,
  type PartyExpiry,
} from "../domain/party-lifecycle";

type RidePartyStatus = (typeof rideParties.$inferSelect)["status"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Cancels a group that missed a deadline. Caller holds the session lock. People who
 * did their part wait again (unless they already moved to another room, which wins);
 * those who never confirmed are released and their photo deleted.
 */
async function releaseExpired(
  tx: Tx,
  party: { id: string },
  outcome: Exclude<PartyExpiry, "none">,
  now: Date,
) {
  const members = await tx
    .select({
      participantId: ridePartyMembers.participantId,
      userId: ridePartyMembers.userId,
      status: ridePartyMembers.status,
    })
    .from(ridePartyMembers)
    .where(eq(ridePartyMembers.partyId, party.id));
  const rejoining = members.filter(
    (m) => outcome === "release_confirmed" || m.status === "confirmed",
  );
  await tx
    .update(rideParties)
    .set({ status: "cancelled", updatedAt: now })
    .where(eq(rideParties.id, party.id));
  await tx
    .update(rides)
    .set({ status: "cancelled", updatedAt: now })
    .where(eq(rides.partyId, party.id));
  await tx
    .delete(ridePartyMembers)
    .where(eq(ridePartyMembers.partyId, party.id));
  const requeued = rejoining.length
    ? await tx
        .update(sessionParticipants)
        .set({ status: "waiting", updatedAt: now })
        .where(
          and(
            inArray(
              sessionParticipants.id,
              rejoining.map((m) => m.participantId),
            ),
            sql`not exists (select 1 from ${sessionParticipants} other where other.user_id = ${sessionParticipants.userId} and other.status = 'waiting')`,
          ),
        )
        .returning({ id: sessionParticipants.id })
    : [];
  const requeuedIds = new Set(requeued.map((r) => r.id));
  const released = members.filter((m) => !requeuedIds.has(m.participantId));
  if (released.length)
    await tx
      .update(sessionParticipants)
      .set({ status: "withdrawn", selfieDataUrl: null, updatedAt: now })
      .where(
        inArray(
          sessionParticipants.id,
          released.map((m) => m.participantId),
        ),
      );
  return {
    // Requeued people first: the dissolve handler rematches on behalf of the first.
    memberUserIds: [
      ...members.filter((m) => requeuedIds.has(m.participantId)),
      ...released,
    ].map((m) => m.userId),
    requeuedCount: requeued.length,
    releasedCount: released.length,
  };
}

export function createPartyRepository(db: Database) {
  return {
    /**
     * Cancels this room's groups that missed a deadline. One indexed read when nothing
     * is due, so room polls can call it; the writes happen under the session lock.
     * Returns the events to announce, one per expired group.
     */
    async sweep(sessionId: string, now = new Date()): Promise<PartyEvent[]> {
      const [due] = await db
        .select({ id: rideParties.id })
        .from(rideParties)
        .where(and(eq(rideParties.sessionId, sessionId), missedDeadline(now)))
        .limit(1);
      if (!due) return [];
      return db.transaction(async (tx) => {
        await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.id, sessionId))
          .for("update");
        const expired = await tx
          .select({
            id: rideParties.id,
            status: rideParties.status,
            confirmBy: rideParties.confirmBy,
            startBy: rideParties.startBy,
          })
          .from(rideParties)
          .where(
            and(eq(rideParties.sessionId, sessionId), missedDeadline(now)),
          );
        const events: PartyEvent[] = [];
        for (const party of expired) {
          const outcome = expiryOf(party, now);
          if (outcome === "none") continue;
          const result = await releaseExpired(tx, party, outcome, now);
          logger.info("party.expired", {
            sessionId,
            partyId: party.id,
            outcome,
            requeuedCount: result.requeuedCount,
            releasedCount: result.releasedCount,
          });
          events.push({
            kind: "dissolved",
            actorUserId: "",
            memberUserIds: result.memberUserIds,
          });
        }
        if (events.length) await bumpRoomRevision(tx, sessionId);
        return events;
      });
    },
    /**
     * Applies one lifecycle command. Takes the same session row lock as joins and
     * matching, so a leave cannot interleave with a match that reuses those people.
     */
    async apply(
      sessionId: string,
      userId: string,
      command: PartyCommand,
      /** The taxi quote, for `set_fare`. */
      fareMinor?: number,
    ): Promise<{ partyStatus: RidePartyStatus; event: PartyEvent | null }> {
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
          .select({
            id: rideParties.id,
            status: rideParties.status,
            confirmBy: rideParties.confirmBy,
            startBy: rideParties.startBy,
            fareMinor: rideParties.fareMinor,
            startedAt: rides.startedAt,
          })
          .from(rideParties)
          .leftJoin(rides, eq(rides.partyId, rideParties.id))
          .where(eq(rideParties.id, mine.partyId));
        const now = new Date();
        // Callers sweep first; this only catches a deadline passing in between.
        if (expiryOf(party, now) !== "none")
          throw new PartyError(
            409,
            "group_expired",
            "Este grupo venció porque no se completó a tiempo. Vuelve a la sala de espera.",
          );
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
          {
            status: party.status,
            fareMinor: party.fareMinor,
            startedAt: party.startedAt,
            members,
          },
          userId,
          command,
          now,
          fareMinor,
        );
        // Every command but a no-op changes what members see.
        if (decision.kind !== "noop") await bumpRoomRevision(tx, sessionId);
        const event = (kind: PartyEvent["kind"]): PartyEvent => ({
          kind,
          actorUserId: userId,
          memberUserIds: members.map((m) => m.userId),
        });
        const setParty = (status: typeof party.status) =>
          tx
            .update(rideParties)
            .set({ status, updatedAt: now })
            .where(eq(rideParties.id, party.id));

        switch (decision.kind) {
          case "noop":
            return { partyStatus: party.status, event: null };
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
                .update(rideParties)
                .set({ startBy: startDeadline(now) })
                .where(eq(rideParties.id, party.id));
              await tx
                .insert(rides)
                .values({ partyId: party.id })
                .onConflictDoNothing();
            }
            return {
              partyStatus: decision.partyStatus,
              event:
                decision.partyStatus === "confirmed"
                  ? event("confirmed")
                  : null,
            };
          }
          case "set_fare": {
            // A new amount needs everyone's agreement again, with a fresh window.
            await tx
              .update(rideParties)
              .set({
                fareMinor: decision.fareMinor,
                status: "forming",
                confirmBy: confirmDeadline(now),
                startBy: null,
                updatedAt: now,
              })
              .where(eq(rideParties.id, party.id));
            await tx
              .update(ridePartyMembers)
              .set({ status: "invited", updatedAt: now })
              .where(eq(ridePartyMembers.partyId, party.id));
            return { partyStatus: "forming", event: null };
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
            // The leaver's photo goes with them; the others keep theirs to rematch.
            await tx
              .update(sessionParticipants)
              .set({ status: "withdrawn", selfieDataUrl: null, updatedAt: now })
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
            return { partyStatus: "cancelled", event: event("dissolved") };
          }
          case "start": {
            await setParty("in_progress");
            await tx
              .update(rides)
              .set({ status: "in_progress", startedAt: now, updatedAt: now })
              .where(eq(rides.partyId, party.id));
            return { partyStatus: "in_progress", event: event("started") };
          }
          case "complete": {
            await setParty("completed");
            const [ride] = await tx
              .update(rides)
              .set({ status: "completed", completedAt: now, updatedAt: now })
              .where(eq(rides.partyId, party.id))
              .returning({ id: rides.id });
            await tx
              .update(ridePartyMembers)
              .set({ status: "dropped_off", updatedAt: now })
              .where(eq(ridePartyMembers.partyId, party.id));
            // Selfies only serve to find each other at pickup; the trip is over.
            await tx
              .update(sessionParticipants)
              .set({ selfieDataUrl: null, updatedAt: now })
              .where(
                inArray(
                  sessionParticipants.id,
                  members.map((m) => m.participantId),
                ),
              );
            await tx
              .update(users)
              .set({ completedRides: sql`${users.completedRides} + 1` })
              .where(
                inArray(
                  users.id,
                  members.map((m) => m.userId),
                ),
              );
            // The transition table allows "complete" once, so each member is charged once.
            for (const member of members) {
              const fee = calculatePlatformFee({ role: member.role });
              await tx.insert(feeLedgerEntries).values({
                userId: member.userId,
                rideId: ride.id,
                entryType: fee.entryType,
                amountMinor: fee.amountMinor,
              });
              if (fee.amountMinor > 0)
                await tx
                  .update(users)
                  .set({
                    creditBalanceMinor: sql`${users.creditBalanceMinor} - ${fee.amountMinor}`,
                  })
                  .where(eq(users.id, member.userId));
            }
            return { partyStatus: "completed", event: event("completed") };
          }
        }
      });
    },
  };
}
export type PartyRepository = ReturnType<typeof createPartyRepository>;
