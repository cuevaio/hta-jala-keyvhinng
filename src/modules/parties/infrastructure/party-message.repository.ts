import { and, desc, eq, gt } from "drizzle-orm";
import type { Database } from "@/db";
import {
  partyMessages,
  rideParties,
  ridePartyMembers,
  sessionParticipants,
  users,
} from "@/db/schema";
import { bumpRoomRevision } from "@/modules/sessions/infrastructure/room-revision";
import { PartyError } from "../domain/party-lifecycle";
import {
  canPostMessages,
  PARTY_MESSAGE_PAGE,
  type PartyMessage,
} from "../domain/party-message";

type Executor = Pick<Database, "select">;

/** The caller's party in this session. Leaving deletes the membership, which ends chat access. */
async function membership(db: Executor, sessionId: string, userId: string) {
  const [row] = await db
    .select({
      partyId: ridePartyMembers.partyId,
      participantId: ridePartyMembers.participantId,
      status: rideParties.status,
    })
    .from(ridePartyMembers)
    .innerJoin(rideParties, eq(rideParties.id, ridePartyMembers.partyId))
    .where(
      and(
        eq(ridePartyMembers.userId, userId),
        eq(rideParties.sessionId, sessionId),
      ),
    );
  if (!row)
    throw new PartyError(
      404,
      "party_not_found",
      "Todavía no tienes un grupo de viaje en esta sala.",
    );
  return row;
}

const messageColumns = {
  seq: partyMessages.seq,
  participantId: partyMessages.participantId,
  displayName: users.displayName,
  body: partyMessages.body,
  createdAt: partyMessages.createdAt,
};

export function createPartyMessageRepository(db: Database) {
  return {
    /** Messages after `afterSeq`, oldest first; the newest page when there are more. */
    async list(
      sessionId: string,
      userId: string,
      afterSeq: number,
    ): Promise<{ canPost: boolean; messages: PartyMessage[] }> {
      const mine = await membership(db, sessionId, userId);
      const rows = await db
        .select(messageColumns)
        .from(partyMessages)
        .innerJoin(
          sessionParticipants,
          eq(sessionParticipants.id, partyMessages.participantId),
        )
        .innerJoin(users, eq(users.id, sessionParticipants.userId))
        .where(
          and(
            eq(partyMessages.partyId, mine.partyId),
            gt(partyMessages.seq, afterSeq),
          ),
        )
        .orderBy(desc(partyMessages.seq))
        .limit(PARTY_MESSAGE_PAGE);
      return {
        canPost: canPostMessages(mine.status),
        messages: rows.reverse(),
      };
    },

    /**
     * Locks the party row so concurrent posts commit in `seq` order and a poll with the
     * last seen seq never skips one. It also orders the post after a concurrent leave,
     * and bumps the room revision so members' room polls pick the message up.
     */
    async post(
      sessionId: string,
      userId: string,
      body: string,
    ): Promise<PartyMessage> {
      return db.transaction(async (tx) => {
        const mine = await membership(tx, sessionId, userId);
        // Session lock before party lock, the order every other writer uses.
        await bumpRoomRevision(tx, sessionId);
        const [party] = await tx
          .select({ status: rideParties.status })
          .from(rideParties)
          .where(eq(rideParties.id, mine.partyId))
          .for("update");
        if (!canPostMessages(party.status))
          throw new PartyError(
            409,
            "chat_closed",
            "El chat de este grupo de viaje ya está cerrado.",
          );
        // A leave that committed while we waited for the lock removed the membership.
        await membership(tx, sessionId, userId);
        const [message] = await tx
          .insert(partyMessages)
          .values({
            partyId: mine.partyId,
            participantId: mine.participantId,
            body,
          })
          .returning({
            seq: partyMessages.seq,
            createdAt: partyMessages.createdAt,
          });
        const [author] = await tx
          .select({ displayName: users.displayName })
          .from(users)
          .where(eq(users.id, userId));
        return {
          ...message,
          participantId: mine.participantId,
          displayName: author.displayName,
          body,
        };
      });
    },
  };
}
export type PartyMessageRepository = ReturnType<
  typeof createPartyMessageRepository
>;
