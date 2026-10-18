import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db";
import {
  places,
  meetingPoints,
  rideParties,
  ridePartyMembers,
  sessionParticipants,
  sessions,
  users,
} from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import { MATCHING_BATCH_SIZE } from "../domain/road-matching";
import type { MatchingRoutePlan } from "../domain/route-plan";

/** Transport-independent command failures; the HTTP adapter translates the status. */
export class MatchingError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Reader = Pick<Database, "select">;
async function load(db: Reader, sessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!session) throw new NotFoundError("Session");
  const [me] = await db
    .select()
    .from(sessionParticipants)
    .where(
      and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, userId),
      ),
    );
  if (!me || me.status === "withdrawn")
    throw new MatchingError(
      403,
      "membership_required",
      "Únete a la sala para buscar un grupo.",
    );
  // Retries after assignment do not route or create additional groups.
  if (me.status === "matched") return { kind: "assigned" as const };
  const [place] = session.placeId
    ? await db.select().from(places).where(eq(places.id, session.placeId))
    : [];
  const now = new Date();
  if (
    session.status !== "open" ||
    session.opensAt > now ||
    session.closesAt <= now ||
    (place && place.status !== "active")
  ) {
    throw new MatchingError(
      409,
      "session_unavailable",
      "Esta sala ya no admite emparejamientos.",
    );
  }
  // Groups snapped to a place meet at its first meeting point; others at their pickup.
  const [pickup] = session.placeId
    ? await db
        .select()
        .from(meetingPoints)
        .where(eq(meetingPoints.placeId, session.placeId))
        .orderBy(asc(meetingPoints.createdAt), asc(meetingPoints.id))
        .limit(1)
    : [];
  const origin = {
    latitude: session.pickupLatitude,
    longitude: session.pickupLongitude,
    label: session.pickupLabel,
  };
  const fields = {
    participantId: sessionParticipants.id,
    userId: sessionParticipants.userId,
    destinationLabel: sessionParticipants.destinationLabel,
    latitude: sessionParticipants.latitude,
    longitude: sessionParticipants.longitude,
    delegatePreference: sessionParticipants.delegatePreference,
    displayName: users.displayName,
    updatedAt: sessionParticipants.updatedAt,
  };
  const candidates = await db
    .select(fields)
    .from(sessionParticipants)
    .innerJoin(users, eq(users.id, sessionParticipants.userId))
    .where(
      and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.status, "waiting"),
      ),
    )
    // Include late arrivals when they request a round, then prefer the oldest waiters.
    .orderBy(
      sql`${sessionParticipants.userId} = ${userId} desc`,
      asc(sessionParticipants.createdAt),
      asc(sessionParticipants.id),
    )
    .limit(MATCHING_BATCH_SIZE);
  if (!candidates.some((c) => c.delegatePreference === "delegate")) {
    const [volunteer] = await db
      .select(fields)
      .from(sessionParticipants)
      .innerJoin(users, eq(users.id, sessionParticipants.userId))
      .where(
        and(
          eq(sessionParticipants.sessionId, sessionId),
          eq(sessionParticipants.status, "waiting"),
          eq(sessionParticipants.delegatePreference, "delegate"),
        ),
      )
      .orderBy(asc(sessionParticipants.createdAt), asc(sessionParticipants.id))
      .limit(1);
    if (volunteer) {
      if (candidates.length === MATCHING_BATCH_SIZE) candidates.pop();
      candidates.push(volunteer);
    }
  }
  return {
    kind: "waiting" as const,
    session,
    origin,
    meetingPointId: pickup?.id ?? null,
    candidates,
  };
}
export type MatchingSnapshot = Extract<
  Awaited<ReturnType<typeof load>>,
  { kind: "waiting" }
>;

// Includes exact inputs, not only millisecond timestamps, to detect same-tick edits.
function fingerprint(s: MatchingSnapshot) {
  return JSON.stringify({
    capacity: s.session.vehicleCapacity,
    origin: s.origin,
    meetingPointId: s.meetingPointId,
    candidates: s.candidates,
  });
}

export function createMatchingRepository(db: Database) {
  return {
    snapshot: (sessionId: string, userId: string) =>
      load(db, sessionId, userId),
    async commit(
      sessionId: string,
      userId: string,
      snapshot: MatchingSnapshot,
      plans: MatchingRoutePlan[],
    ) {
      return db.transaction(async (tx) => {
        await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.id, sessionId))
          .for("update");
        const current = await load(tx, sessionId, userId);
        if (current.kind === "assigned")
          return { createdPartyCount: 0, alreadyMatched: true };
        if (fingerprint(current) !== fingerprint(snapshot)) {
          throw new MatchingError(
            409,
            "matching_snapshot_changed",
            "La sala cambió. Busca tu grupo otra vez.",
          );
        }
        for (const plan of plans) {
          const [party] = await tx
            .insert(rideParties)
            .values({
              sessionId,
              meetingPointId: snapshot.meetingPointId,
              routePlan: plan,
            })
            .returning({ id: rideParties.id });
          await tx.insert(ridePartyMembers).values(
            plan.stops.map((stop) => ({
              partyId: party.id,
              participantId: stop.participantId,
              userId: stop.userId,
              role: stop.role,
              dropOffOrder: stop.dropOffOrder,
              fareShareBps: stop.fareShareBps,
            })),
          );
          await tx
            .update(sessionParticipants)
            .set({ status: "matched" })
            .where(
              inArray(
                sessionParticipants.id,
                plan.stops.map((stop) => stop.participantId),
              ),
            );
        }
        // The pool stays open so unmatched people can join later matching rounds.
        return { createdPartyCount: plans.length, alreadyMatched: false };
      });
    },
  };
}
export type MatchingRepository = ReturnType<typeof createMatchingRepository>;
