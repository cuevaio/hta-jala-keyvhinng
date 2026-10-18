import {
  and,
  asc,
  between,
  count,
  desc,
  eq,
  gt,
  inArray,
  lte,
  ne,
} from "drizzle-orm";
import type { Database } from "@/db";
import {
  meetingPoints,
  places,
  rideParties,
  ridePartyMembers,
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
const shortName = (label: string) => label.split(",")[0].trim().slice(0, 60);

export interface GroupMatch {
  id: string;
  name: string;
  pickupLabel: string;
  destinationLabel: string;
  departsAt: Date;
  waitingCount: number;
  affinity: Affinity;
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

/** One live group at a time: groups they were only waiting in are released. */
async function claimExclusivity(tx: Tx, sessionId: string, userId: string) {
  const [busy] = await tx
    .select({ sessionId: rideParties.sessionId })
    .from(ridePartyMembers)
    .innerJoin(rideParties, eq(rideParties.id, ridePartyMembers.partyId))
    .where(
      and(
        eq(ridePartyMembers.userId, userId),
        ne(rideParties.sessionId, sessionId),
        inArray(rideParties.status, [...LIVE_PARTY_STATUSES]),
      ),
    )
    .limit(1);
  if (busy)
    throw new ApiError(
      409,
      "already_in_group",
      "Ya estás en un grupo de viaje activo. Termínalo o sal de él antes de entrar a otra sala.",
    );
  await tx
    .update(sessionParticipants)
    .set({ status: "withdrawn" })
    .where(
      and(
        eq(sessionParticipants.userId, userId),
        eq(sessionParticipants.status, "waiting"),
        ne(sessionParticipants.sessionId, sessionId),
      ),
    );
}

/** Caller holds the session row lock. */
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
  return participant;
}

export function createParticipationRepository(db: Database) {
  return {
    /** Open groups that fit this ride, best fit first. Public: no account needed. */
    async search(query: SearchGroupsQuery): Promise<GroupMatch[]> {
      const now = new Date();
      const intent: RideIntent = {
        origin: { latitude: query.olat, longitude: query.olng },
        destination: { latitude: query.dlat, longitude: query.dlng },
        departsAt: departureFor(query.depart, now),
      };
      const pickupBox = boundingBox(intent.origin, PICKUP_RADIUS_METERS);
      const destinationBox = boundingBox(
        intent.destination,
        DESTINATION_RADIUS_METERS,
      );
      const windowMs = DEPARTURE_WINDOW_MINUTES * 60_000;
      const rows = await db
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
            between(
              sessions.pickupLatitude,
              pickupBox.minLat,
              pickupBox.maxLat,
            ),
            between(
              sessions.pickupLongitude,
              pickupBox.minLon,
              pickupBox.maxLon,
            ),
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
        const affinity = affinityOf(anchorsOf(row), intent);
        return affinity ? [{ row, affinity }] : [];
      });
      fitting.sort(
        (a, b) => affinityScore(a.affinity) - affinityScore(b.affinity),
      );
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
    /** Starts a group around this ride, anchored on a nearby place when there is one. */
    async createGroup(userId: string, input: CreateGroupInput) {
      return db.transaction(async (tx) => {
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
        const [session] = await tx
          .insert(sessions)
          .values({
            placeId: place?.id ?? null,
            name: `Hacia ${shortName(input.destinationLabel)}`,
            pickupLabel: pickup.label,
            pickupLatitude: pickup.latitude,
            pickupLongitude: pickup.longitude,
            destinationLabel: input.destinationLabel,
            destinationLatitude: input.latitude,
            destinationLongitude: input.longitude,
            departsAt,
            opensAt: new Date(),
            closesAt: closesAtFor(departsAt),
            vehicleCapacity: 3,
          })
          .returning();
        await joinLocked(tx, session, userId, input);
        return session;
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
        return joinLocked(tx, session, userId, input);
      });
    },
    /** The group this person is still part of, so the request screen can resume it. */
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
      for (const c of candidates) {
        if (c.status === "waiting") {
          if (c.sessionStatus === "open" && c.closesAt > now) return c;
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
            ),
          );
        if (live) return c;
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
                  selfieDataUrl: sessionParticipants.selfieDataUrl,
                  participantId: ridePartyMembers.participantId,
                  status: ridePartyMembers.status,
                })
                .from(ridePartyMembers)
                .innerJoin(
                  sessionParticipants,
                  eq(sessionParticipants.id, ridePartyMembers.participantId),
                )
                .where(eq(ridePartyMembers.partyId, party.id))
                .orderBy(asc(ridePartyMembers.dropOffOrder))
            : [];
          const { selfieDataUrl: _selfie, ...meWithoutSelfie } = me;
          void _selfie;
          const now = new Date();
          return {
            session,
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
  };
}
export type WaitingRoom = Awaited<
  ReturnType<ReturnType<typeof createParticipationRepository>["waitingRoom"]>
>;
