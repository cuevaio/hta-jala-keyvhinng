import {
  and,
  asc,
  between,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/db";
import {
  meetingPoints,
  places,
  rideParties,
  ridePartyMembers,
  rides,
  sessionParticipants,
  sessions,
  users,
} from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import { ApiError } from "@/lib/http";
import {
  canAffordRide,
  formatSoles,
  PLATFORM_FEE_MINOR,
} from "@/modules/payments/domain/fees";
import {
  affinityOf,
  affinityScore,
  ASSIGN_DEPARTURE_WINDOW_MINUTES,
  boundingBox,
  closesAtFor,
  departureFor,
  DEPARTURE_WINDOW_MINUTES,
  DESTINATION_RADIUS_METERS,
  haversineMeters,
  MAX_GROUP_SIZE,
  PICKUP_RADIUS_METERS,
  type Affinity,
  type RideIntent,
} from "../domain/affinity";
import { withinDeadline } from "@/modules/parties/infrastructure/party-deadlines";
import {
  publicAnchor,
  publicDestination,
  roomName,
} from "../domain/public-room";
import { selfiePath } from "../domain/selfie";
import { bumpOtherRoomRevisions, bumpRoomRevision } from "./room-revision";
import type {
  CreateGroupInput,
  JoinSessionInput,
  SearchGroupsQuery,
} from "../schemas/session.schema";

/** A start this close to a known place is snapped to its meeting point. */
const PLACE_SNAP_METERS = 400;
const LIVE_PARTY_STATUSES = ["forming", "confirmed", "in_progress"] as const;

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type SessionRow = typeof sessions.$inferSelect;

function assertOpen(session: SessionRow, now: Date) {
  if (
    session.status !== "open" ||
    session.opensAt > now ||
    session.closesAt <= now
  ) {
    throw new ApiError(
      409,
      "session_unavailable",
      "Esta sala ya no está abierta. Busca otra o crea una.",
    );
  }
}

const originOf = (input: JoinSessionInput) => ({
  latitude: input.originLatitude,
  longitude: input.originLongitude,
});
const destinationOf = (input: JoinSessionInput) => ({
  latitude: input.latitude,
  longitude: input.longitude,
});
const anchorsOf = (session: SessionRow) => ({
  pickup: {
    latitude: session.pickupLatitude,
    longitude: session.pickupLongitude,
  },
  destination: {
    latitude: session.destinationLatitude,
    longitude: session.destinationLongitude,
  },
  departsAt: session.departsAt,
});

export const SEAT_ACTIONS = ["withdraw", "offer_to_book"] as const;
export type SeatAction = (typeof SEAT_ACTIONS)[number];

export interface GroupMatch {
  id: string;
  name: string;
  pickupLabel: string;
  destinationLabel: string;
  departsAt: Date;
  waitingCount: number;
  affinity: Affinity;
}

/** Errors that rule out one room but leave the rider free to try the next. */
const ROOM_UNSUITABLE = new Set([
  "session_unavailable",
  "place_unavailable",
  "group_mismatch",
  "group_full",
]);

/** Open groups that fit this ride, best fit first. */
async function fittingSessions(
  reader: Pick<Database, "select">,
  intent: RideIntent,
  window = DEPARTURE_WINDOW_MINUTES,
) {
  const now = new Date();
  const pickupBox = boundingBox(intent.origin, PICKUP_RADIUS_METERS);
  const destinationBox = boundingBox(
    intent.destination,
    DESTINATION_RADIUS_METERS,
  );
  const windowMs = window * 60_000;
  const rows = await reader
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.status, "open"),
        lte(sessions.opensAt, now),
        gt(sessions.closesAt, now),
        between(
          sessions.departsAt,
          new Date(intent.departsAt.getTime() - windowMs),
          new Date(intent.departsAt.getTime() + windowMs),
        ),
        between(sessions.pickupLatitude, pickupBox.minLat, pickupBox.maxLat),
        between(sessions.pickupLongitude, pickupBox.minLon, pickupBox.maxLon),
        between(
          sessions.destinationLatitude,
          destinationBox.minLat,
          destinationBox.maxLat,
        ),
        between(
          sessions.destinationLongitude,
          destinationBox.minLon,
          destinationBox.maxLon,
        ),
      ),
    )
    .limit(50);
  const fitting = rows.flatMap((row) => {
    const affinity = affinityOf(anchorsOf(row), intent, window);
    return affinity ? [{ row, affinity }] : [];
  });
  return fitting.sort(
    (a, b) => affinityScore(a.affinity) - affinityScore(b.affinity),
  );
}

async function waitingCount(
  reader: Pick<Database, "select">,
  sessionId: string,
) {
  const [row] = await reader
    .select({ n: count() })
    .from(sessionParticipants)
    .where(
      and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.status, "waiting"),
      ),
    );
  return row.n;
}

/**
 * One live group at a time: groups they were only waiting in are released. The caller
 * holds the account lock. Releasing comes first: if a matching commit took one of
 * those seats a moment ago, the release finds nothing and the busy check below sees
 * the committed group.
 */
async function claimExclusivity(tx: Tx, sessionId: string, userId: string) {
  const released = await tx
    .update(sessionParticipants)
    .set({ status: "withdrawn", selfieDataUrl: null })
    .where(
      and(
        eq(sessionParticipants.userId, userId),
        eq(sessionParticipants.status, "waiting"),
        ne(sessionParticipants.sessionId, sessionId),
      ),
    )
    .returning({ sessionId: sessionParticipants.sessionId });
  const [busy] = await tx
    .select({ sessionId: rideParties.sessionId })
    .from(ridePartyMembers)
    .innerJoin(rideParties, eq(rideParties.id, ridePartyMembers.partyId))
    .where(
      and(
        eq(ridePartyMembers.userId, userId),
        ne(rideParties.sessionId, sessionId),
        inArray(rideParties.status, [...LIVE_PARTY_STATUSES]),
        withinDeadline(new Date()),
      ),
    )
    .limit(1);
  if (busy)
    throw new ApiError(
      409,
      "already_in_group",
      "Ya estás en un grupo de viaje activo. Termínalo o sal de él antes de entrar a otra sala.",
    );
  await bumpOtherRoomRevisions(
    tx,
    released.map((r) => r.sessionId),
  );
}

/**
 * Serializes everything one account does across rooms. Taken before any room lock, so
 * two requests from the same account queue instead of each claiming a seat, and so
 * lock order is always account → room (releasing a seat touches the other room's row).
 */
async function lockAccount(tx: Tx, userId: string) {
  await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
}

/** Caller holds the account lock, then the session row lock. */
async function joinLocked(
  tx: Tx,
  session: SessionRow,
  userId: string,
  input: JoinSessionInput,
) {
  assertOpen(session, new Date());
  if (session.placeId) {
    const [place] = await tx
      .select({ status: places.status })
      .from(places)
      .where(eq(places.id, session.placeId));
    if (place && place.status !== "active")
      throw new ApiError(
        409,
        "place_unavailable",
        "Este lugar ya no admite pasajeros.",
      );
  }
  // Time already fits (the group's own); this checks where they start and end.
  const fits = affinityOf(anchorsOf(session), {
    origin: originOf(input),
    destination: destinationOf(input),
    departsAt: session.departsAt,
  });
  if (!fits)
    throw new ApiError(
      409,
      "group_mismatch",
      "Esta sala sale de otra zona o va hacia otro lado. Busca una que te quede mejor.",
    );
  const [existing] = await tx
    .select()
    .from(sessionParticipants)
    .where(
      and(
        eq(sessionParticipants.sessionId, session.id),
        eq(sessionParticipants.userId, userId),
      ),
    );
  if (existing?.status === "matched")
    throw new ApiError(
      409,
      "already_matched",
      "Ya perteneces a un grupo de viaje.",
    );
  if (
    existing?.status !== "waiting" &&
    (await waitingCount(tx, session.id)) >= MAX_GROUP_SIZE
  )
    throw new ApiError(
      409,
      "group_full",
      "Esta sala ya está llena. Busca otra o crea una.",
    );
  const [account] = await tx
    .select({ creditBalanceMinor: users.creditBalanceMinor })
    .from(users)
    .where(eq(users.id, userId));
  // Matching may assign anyone the passenger role, so everyone needs one fee of credit.
  if (!account || !canAffordRide(account.creditBalanceMinor))
    throw new ApiError(
      402,
      "insufficient_credit",
      `Tu saldo no alcanza para un viaje. Cada viaje como pasajero cuesta ${formatSoles(PLATFORM_FEE_MINOR)}.`,
    );
  await claimExclusivity(tx, session.id, userId);
  if (input.displayName)
    await tx
      .update(users)
      .set({ displayName: input.displayName })
      .where(eq(users.id, userId));
  const values = {
    selfieDataUrl: input.selfieDataUrl,
    originLabel: input.originLabel,
    originLatitude: input.originLatitude,
    originLongitude: input.originLongitude,
    destinationLabel: input.destinationLabel,
    latitude: input.latitude,
    longitude: input.longitude,
    delegatePreference: input.delegatePreference,
    status: "waiting" as const,
  };
  const [participant] = await tx
    .insert(sessionParticipants)
    .values({ sessionId: session.id, userId, ...values })
    .onConflictDoUpdate({
      target: [sessionParticipants.sessionId, sessionParticipants.userId],
      set: values,
    })
    .returning();
  await bumpRoomRevision(tx, session.id);
  return participant;
}

/**
 * Starts a group around this ride, anchored on a nearby place when there is one, and
 * joins the rider to it. Caller holds the account lock.
 */
async function createLocked(tx: Tx, userId: string, input: CreateGroupInput) {
  const origin = originOf(input);
  const box = boundingBox(origin, PLACE_SNAP_METERS);
  const nearby = await tx
    .select()
    .from(places)
    .where(
      and(
        eq(places.status, "active"),
        between(places.latitude, box.minLat, box.maxLat),
        between(places.longitude, box.minLon, box.maxLon),
      ),
    );
  const place =
    nearby
      .map((p) => ({
        p,
        d: haversineMeters(origin, {
          latitude: p.latitude,
          longitude: p.longitude,
        }),
      }))
      .filter(({ d }) => d <= PLACE_SNAP_METERS)
      .sort((a, b) => a.d - b.d)[0]?.p ?? null;
  const [meetingPoint] = place
    ? await tx
        .select()
        .from(meetingPoints)
        .where(eq(meetingPoints.placeId, place.id))
        .orderBy(asc(meetingPoints.createdAt), asc(meetingPoints.id))
        .limit(1)
    : [];
  const pickup = meetingPoint
    ? {
        label: meetingPoint.name,
        latitude: meetingPoint.latitude,
        longitude: meetingPoint.longitude,
      }
    : place
      ? {
          label: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
        }
      : {
          label: input.originLabel,
          latitude: input.originLatitude,
          longitude: input.originLongitude,
        };
  const departsAt = departureFor(input.departInMinutes);
  // The room is public: it gets the district and a coarse anchor, never the
  // creator's address. Their exact destination stays on their participant row.
  const heading = publicDestination(input.destinationArea);
  const anchor = publicAnchor(destinationOf(input));
  const [{ opened }] = await tx.select({ opened: count() }).from(sessions);
  const [session] = await tx
    .insert(sessions)
    .values({
      placeId: place?.id ?? null,
      name: roomName(opened),
      createdByUserId: userId,
      pickupLabel: pickup.label,
      pickupLatitude: pickup.latitude,
      pickupLongitude: pickup.longitude,
      destinationLabel: heading.label,
      destinationLatitude: anchor.latitude,
      destinationLongitude: anchor.longitude,
      departsAt,
      opensAt: new Date(),
      closesAt: closesAtFor(departsAt),
      vehicleCapacity: 3,
    })
    .returning();
  await joinLocked(tx, session, userId, input);
  return session;
}

export function createParticipationRepository(db: Database) {
  return {
    /** Open groups that fit this ride, best fit first. Public: no account needed. */
    async search(query: SearchGroupsQuery): Promise<GroupMatch[]> {
      const fitting = await fittingSessions(db, {
        origin: { latitude: query.olat, longitude: query.olng },
        destination: { latitude: query.dlat, longitude: query.dlng },
        departsAt: departureFor(query.depart, new Date()),
      });
      const matches: GroupMatch[] = [];
      for (const { row, affinity } of fitting.slice(0, 10)) {
        const waiting = await waitingCount(db, row.id);
        if (waiting >= MAX_GROUP_SIZE) continue;
        matches.push({
          id: row.id,
          name: row.name,
          pickupLabel: row.pickupLabel,
          destinationLabel: row.destinationLabel,
          departsAt: row.departsAt,
          waitingCount: waiting,
          affinity,
        });
      }
      return matches;
    },
    /** Starts a group around this ride and joins its creator. */
    async createGroup(userId: string, input: CreateGroupInput) {
      return db.transaction(async (tx) => {
        await lockAccount(tx, userId);
        return createLocked(tx, userId, input);
      });
    },
    /**
     * Puts the rider in the best open group for their ride, or starts one when none
     * fits. Riders are assigned one at a time, so two people asking for the same route
     * at once share a room instead of each starting one and waiting alone.
     */
    async assign(userId: string, input: CreateGroupInput) {
      return db.transaction(async (tx) => {
        // Taken before the account lock, and by nothing else, so it cannot deadlock.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('jala:room-assign'))`,
        );
        await lockAccount(tx, userId);
        const fitting = await fittingSessions(
          tx,
          {
            origin: originOf(input),
            destination: destinationOf(input),
            departsAt: departureFor(input.departInMinutes),
          },
          ASSIGN_DEPARTURE_WINDOW_MINUTES,
        );
        // Asking again keeps the room they are already waiting in, if it still fits.
        const [current] = await tx
          .select({ sessionId: sessionParticipants.sessionId })
          .from(sessionParticipants)
          .where(
            and(
              eq(sessionParticipants.userId, userId),
              eq(sessionParticipants.status, "waiting"),
            ),
          )
          .limit(1);
        const ordered = [
          ...fitting.filter((f) => f.row.id === current?.sessionId),
          ...fitting.filter((f) => f.row.id !== current?.sessionId),
        ];
        for (const { row } of ordered) {
          // Same lock as join and matching; every check below re-reads under it.
          const [session] = await tx
            .select()
            .from(sessions)
            .where(eq(sessions.id, row.id))
            .for("update");
          try {
            await joinLocked(tx, session, userId, input);
            return { session, created: false, candidates: fitting.length };
          } catch (error) {
            // joinLocked raises these before it writes anything.
            if (error instanceof ApiError && ROOM_UNSUITABLE.has(error.code))
              continue;
            throw error;
          }
        }
        return {
          session: await createLocked(tx, userId, input),
          created: true,
          candidates: fitting.length,
        };
      });
    },
    async join(sessionId: string, userId: string, input: JoinSessionInput) {
      return db.transaction(async (tx) => {
        await lockAccount(tx, userId);
        // All join and matching commits serialize on this same session row.
        const [session] = await tx
          .select()
          .from(sessions)
          .where(eq(sessions.id, sessionId))
          .for("update");
        if (!session) throw new NotFoundError("Session");
        return joinLocked(tx, session, userId, input);
      });
    },
    /**
     * Changes a waiting seat: `withdraw` leaves the room, `offer_to_book` volunteers to
     * book the taxi (every group needs one booker). A seat already in a group is changed
     * through the group instead. Withdrawing twice is a no-op.
     */
    async updateSeat(
      sessionId: string,
      userId: string,
      action: SeatAction,
    ): Promise<{ changed: boolean }> {
      return db.transaction(async (tx) => {
        await lockAccount(tx, userId);
        const [session] = await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.id, sessionId))
          .for("update");
        if (!session) throw new NotFoundError("Session");
        const [seat] = await tx
          .update(sessionParticipants)
          .set(
            action === "withdraw"
              ? { status: "withdrawn", selfieDataUrl: null }
              : { delegatePreference: "delegate" },
          )
          .where(
            and(
              eq(sessionParticipants.sessionId, sessionId),
              eq(sessionParticipants.userId, userId),
              eq(sessionParticipants.status, "waiting"),
            ),
          )
          .returning({ id: sessionParticipants.id });
        if (seat) {
          await bumpRoomRevision(tx, sessionId);
          return { changed: true };
        }
        const [current] = await tx
          .select({ status: sessionParticipants.status })
          .from(sessionParticipants)
          .where(
            and(
              eq(sessionParticipants.sessionId, sessionId),
              eq(sessionParticipants.userId, userId),
            ),
          );
        if (current?.status === "matched")
          throw new ApiError(
            409,
            "already_matched",
            "Ya estás en un grupo de viaje. Usa las opciones del grupo.",
          );
        if (action === "withdraw") return { changed: false };
        throw new ApiError(
          409,
          "not_waiting",
          "Ya no estás en esta sala. Vuelve a unirte para continuar.",
        );
      });
    },
    /** The group this person is still part of, so the request screen can resume it. */
    /** Whether this account opened the room. Kept off the public room summary. */
    async opened(sessionId: string, userId: string) {
      const [row] = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(eq(sessions.id, sessionId), eq(sessions.createdByUserId, userId)),
        );
      return Boolean(row);
    },
    async activeFor(userId: string) {
      const now = new Date();
      const candidates = await db
        .select({
          sessionId: sessions.id,
          name: sessions.name,
          departsAt: sessions.departsAt,
          status: sessionParticipants.status,
          sessionStatus: sessions.status,
          closesAt: sessions.closesAt,
          createdByUserId: sessions.createdByUserId,
        })
        .from(sessionParticipants)
        .innerJoin(sessions, eq(sessions.id, sessionParticipants.sessionId))
        .where(
          and(
            eq(sessionParticipants.userId, userId),
            inArray(sessionParticipants.status, ["waiting", "matched"]),
          ),
        )
        .orderBy(desc(sessionParticipants.updatedAt))
        .limit(5);
      const found = ({
        createdByUserId,
        ...c
      }: (typeof candidates)[number]) => ({
        ...c,
        mine: createdByUserId === userId,
      });
      for (const c of candidates) {
        if (c.status === "waiting") {
          if (c.sessionStatus === "open" && c.closesAt > now) return found(c);
          continue;
        }
        const [live] = await db
          .select({ id: rideParties.id })
          .from(ridePartyMembers)
          .innerJoin(rideParties, eq(rideParties.id, ridePartyMembers.partyId))
          .where(
            and(
              eq(ridePartyMembers.userId, userId),
              eq(rideParties.sessionId, c.sessionId),
              inArray(rideParties.status, [...LIVE_PARTY_STATUSES]),
              withinDeadline(now),
            ),
          );
        if (live) return found(c);
      }
      return null;
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
              "Entra a esta sala para ver quiénes esperan.",
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
          const [place] = session.placeId
            ? await tx
                .select({ status: places.status })
                .from(places)
                .where(eq(places.id, session.placeId))
            : [];
          const [party] = await tx
            .select({
              id: rideParties.id,
              status: rideParties.status,
              plan: rideParties.routePlan,
              confirmBy: rideParties.confirmBy,
              startBy: rideParties.startBy,
              fareMinor: rideParties.fareMinor,
              startedAt: rides.startedAt,
            })
            .from(ridePartyMembers)
            .innerJoin(
              rideParties,
              eq(rideParties.id, ridePartyMembers.partyId),
            )
            .leftJoin(rides, eq(rides.partyId, rideParties.id))
            .where(
              and(
                eq(ridePartyMembers.participantId, me.id),
                eq(rideParties.sessionId, sessionId),
              ),
            );
          // Same for every member, so group members always see an identical party.
          // Photos are served by their own cacheable URL so polls stay a few KB.
          const memberRows = party
            ? await tx
                .select({
                  participantId: ridePartyMembers.participantId,
                  status: ridePartyMembers.status,
                  hasSelfie: sql<boolean>`${sessionParticipants.selfieDataUrl} is not null`,
                  photoVersion: sessionParticipants.updatedAt,
                })
                .from(ridePartyMembers)
                .innerJoin(
                  sessionParticipants,
                  eq(sessionParticipants.id, ridePartyMembers.participantId),
                )
                .where(eq(ridePartyMembers.partyId, party.id))
                .orderBy(asc(ridePartyMembers.dropOffOrder))
            : [];
          const members = memberRows.map(
            ({ hasSelfie, photoVersion, ...member }) => ({
              ...member,
              selfieUrl: hasSelfie
                ? selfiePath(sessionId, member.participantId, photoVersion)
                : null,
            }),
          );
          const { selfieDataUrl: _selfie, ...meWithoutSelfie } = me;
          void _selfie;
          const now = new Date();
          return {
            session,
            revision: session.revision,
            serverNow: now.toISOString(),
            me: meWithoutSelfie,
            party: party ? { ...party, members } : null,
            participants,
            acceptingJoins:
              (!place || place.status === "active") &&
              session.status === "open" &&
              session.opensAt <= now &&
              session.closesAt > now,
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    /**
     * The room's current revision, with the same membership rule as `waitingRoom`.
     * One indexed read, so polls can skip the full room when nothing changed.
     */
    async roomRevision(sessionId: string, userId: string) {
      const [row] = await db
        .select({
          revision: sessions.revision,
          status: sessionParticipants.status,
        })
        .from(sessions)
        .leftJoin(
          sessionParticipants,
          and(
            eq(sessionParticipants.sessionId, sessions.id),
            eq(sessionParticipants.userId, userId),
          ),
        )
        .where(eq(sessions.id, sessionId));
      if (!row) throw new NotFoundError("Session");
      if (!row.status || row.status === "withdrawn")
        throw new ApiError(
          403,
          "membership_required",
          "Entra a esta sala para ver quiénes esperan.",
        );
      return row.revision;
    },
    /**
     * A party member's photo, only for members of that same party (including the
     * participant). Null when the requester may not see it or there is no photo.
     */
    async selfieFor(
      sessionId: string,
      userId: string,
      participantId: string,
    ): Promise<string | null> {
      const requester = alias(ridePartyMembers, "requester");
      const [row] = await db
        .select({ selfieDataUrl: sessionParticipants.selfieDataUrl })
        .from(ridePartyMembers)
        .innerJoin(
          requester,
          and(
            eq(requester.partyId, ridePartyMembers.partyId),
            eq(requester.userId, userId),
          ),
        )
        .innerJoin(rideParties, eq(rideParties.id, ridePartyMembers.partyId))
        .innerJoin(
          sessionParticipants,
          eq(sessionParticipants.id, ridePartyMembers.participantId),
        )
        .where(
          and(
            eq(ridePartyMembers.participantId, participantId),
            eq(rideParties.sessionId, sessionId),
            // Photos are for finding each other before and during the ride only.
            inArray(rideParties.status, [...LIVE_PARTY_STATUSES]),
            isNotNull(sessionParticipants.selfieDataUrl),
          ),
        );
      return row?.selfieDataUrl ?? null;
    },
  };
}
export type WaitingRoom = Awaited<
  ReturnType<ReturnType<typeof createParticipationRepository>["waitingRoom"]>
>;
