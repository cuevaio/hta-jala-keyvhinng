import { selfieDataUrl } from "../fixtures/selfie";
import { randomUUID } from "node:crypto";
import { groupAnchors, originFields } from "./group-fixture";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { createParticipationRepository } from "@/modules/sessions/infrastructure/participation.repository";
import { createMatchingRepository } from "@/modules/matching/infrastructure/matching.repository";
import { createMatchingApplication } from "@/modules/matching/application/matching.service";
import { createRoadMatchingService } from "@/modules/matching/domain/road-matching";
import { createPartyRepository } from "@/modules/parties/infrastructure/party.repository";
import type { RoutingProvider } from "@/modules/routing/domain/routing-provider";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("party lifecycle", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 8 });
  const db = drizzle(sql, { schema });
  const participation = createParticipationRepository(db);
  const parties = createPartyRepository(db);
  const routing: RoutingProvider = {
    estimateMatrix: async (points) => ({
      durationsSeconds: points.map(() => points.map(() => 100)),
    }),
    estimateDuration: async () => 100,
    estimateDistance: async () => 1000,
    estimateRoute: async (points) => ({
      legs: points.slice(1).map((to, i) => ({
        from: points[i],
        to,
        distanceMeters: 1000,
        durationSeconds: 100,
      })),
      totalDistanceMeters: (points.length - 1) * 1000,
      totalDurationSeconds: (points.length - 1) * 100,
    }),
  };
  const matching = createMatchingApplication(
    createMatchingRepository(db),
    createRoadMatchingService(routing),
    "fixture",
  );
  const placeId = randomUUID();
  const userIds = Array.from({ length: 4 }, () => randomUUID());
  const input = {
    selfieDataUrl,
    ...originFields,
    displayName: "Lifecycle fixture",
    destinationLabel: "Fixture destination",
    latitude: -12.1,
    longitude: -77.03,
    delegatePreference: "passenger" as "delegate" | "passenger",
  };

  /** A fresh session where the first `count` users are matched into one party. */
  async function matchedSession(count = 3) {
    // Users are reused across tests, and a person may be in only one live group.
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.placeId, placeId));
    const [session] = await db
      .insert(schema.sessions)
      .values({
        placeId,
        ...groupAnchors,
        departsAt: new Date(),
        vehicleCapacity: 3,
        opensAt: new Date(Date.now() - 1000),
        closesAt: new Date(Date.now() + 60000),
      })
      .returning();
    for (let i = 0; i < count; i++)
      await participation.join(session.id, userIds[i], {
        ...input,
        delegatePreference: i === 0 ? "delegate" : "passenger",
      });
    await matching.match(session.id, userIds[0]);
    return session;
  }
  const room = (sessionId: string, user: number) =>
    participation.waitingRoom(sessionId, userIds[user]);

  beforeAll(async () => {
    await db.insert(schema.places).values({
      id: placeId,
      slug: `lifecycle-${placeId}`,
      name: "Lifecycle fixture",
      latitude: -12,
      longitude: -77,
      status: "active",
      isFictional: true,
    });
    await db
      .insert(schema.users)
      .values(userIds.map((id) => ({ id, displayName: "Lifecycle fixture" })));
  });
  afterAll(async () => {
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.placeId, placeId));
    await db.delete(schema.places).where(eq(schema.places.id, placeId));
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    await sql.end();
  });

  it("keeps formed groups usable after the waiting room expires", async () => {
    const s = await matchedSession();
    await db
      .update(schema.sessions)
      .set({ closesAt: new Date(Date.now() - 1) })
      .where(eq(schema.sessions.id, s.id));
    expect((await room(s.id, 0)).acceptingJoins).toBe(false);
    expect((await room(s.id, 0)).party).not.toBeNull();
    for (const user of userIds.slice(0, 3))
      await parties.apply(s.id, user, "confirm");
    await parties.apply(s.id, userIds[0], "start");
    await parties.apply(s.id, userIds[0], "complete");
    expect((await room(s.id, 0)).party!.status).toBe("completed");
  });
  it("runs confirm → start → complete and books the ride record", async () => {
    const s = await matchedSession();
    const [a, b, c] = userIds;
    expect(await parties.apply(s.id, a, "confirm")).toEqual({
      partyStatus: "forming",
      event: null,
    });
    expect(await parties.apply(s.id, a, "confirm")).toEqual({
      partyStatus: "forming",
      event: null,
    }); // idempotent retry
    await parties.apply(s.id, b, "confirm");
    // Only the last confirmation is news worth telling everyone.
    expect(await parties.apply(s.id, c, "confirm")).toEqual({
      partyStatus: "confirmed",
      event: {
        kind: "confirmed",
        actorUserId: c,
        memberUserIds: expect.arrayContaining([a, b, c]),
      },
    });
    expect((await room(s.id, 1)).party!.members.map((m) => m.status)).toEqual([
      "confirmed",
      "confirmed",
      "confirmed",
    ]);
    await expect(parties.apply(s.id, b, "start")).rejects.toMatchObject({
      code: "delegate_required",
    });
    await parties.apply(s.id, a, "start");
    await expect(parties.apply(s.id, c, "leave")).rejects.toMatchObject({
      code: "ride_started",
    });
    const balances = async () =>
      new Map(
        (
          await db
            .select({
              id: schema.users.id,
              credit: schema.users.creditBalanceMinor,
            })
            .from(schema.users)
            .where(inArray(schema.users.id, [a, b, c]))
        ).map((u) => [u.id, u.credit]),
      );
    const before = await balances();
    const members = (await room(s.id, 1)).party!.members;
    // While the ride is live, a member can see the others' photos.
    expect(
      await participation.selfieFor(s.id, b, members[0].participantId),
    ).not.toBeNull();
    await parties.apply(s.id, a, "complete");
    const after = await balances();
    // Photos only serve to meet at pickup: gone once the trip ends.
    expect(
      await participation.selfieFor(s.id, b, members[0].participantId),
    ).toBeNull();
    const photos = await db
      .select({ selfie: schema.sessionParticipants.selfieDataUrl })
      .from(schema.sessionParticipants)
      .where(
        inArray(
          schema.sessionParticipants.id,
          members.map((m) => m.participantId),
        ),
      );
    expect(photos.every((p) => p.selfie === null)).toBe(true);
    // `a` is the delegate and rides free; passengers pay S/ 0.10 each.
    expect(after.get(a)).toBe(before.get(a));
    expect(after.get(b)).toBe(before.get(b)! - 10);
    expect(after.get(c)).toBe(before.get(c)! - 10);
    const party = (await room(s.id, 2)).party!;
    expect(party.status).toBe("completed");
    const [ride] = await db
      .select()
      .from(schema.rides)
      .where(eq(schema.rides.partyId, party.id));
    expect(ride.status).toBe("completed");
    expect(ride.startedAt).not.toBeNull();
    const fees = await db
      .select()
      .from(schema.feeLedgerEntries)
      .where(eq(schema.feeLedgerEntries.rideId, ride.id));
    expect(
      Object.fromEntries(fees.map((f) => [f.userId, f.entryType])),
    ).toEqual({
      [a]: "free_ride_waiver",
      [b]: "platform_fee",
      [c]: "platform_fee",
    });
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, a));
    expect(user.completedRides).toBeGreaterThanOrEqual(1);
  });

  it("dissolves on leave: leaver withdrawn, others rematchable with a fresh plan", async () => {
    const s = await matchedSession();
    const [a, b, c] = userIds;
    await parties.apply(s.id, a, "confirm");
    const before = (await room(s.id, 1)).party!;
    await parties.apply(s.id, c, "leave");

    // Everyone's party is gone, the leaver is out, the others wait again.
    expect((await room(s.id, 1)).party).toBeNull();
    const seats = await db
      .select({
        userId: schema.sessionParticipants.userId,
        selfie: schema.sessionParticipants.selfieDataUrl,
      })
      .from(schema.sessionParticipants)
      .where(eq(schema.sessionParticipants.sessionId, s.id));
    const photoOf = (u: string) => seats.find((x) => x.userId === u)?.selfie;
    // The leaver's photo is deleted; the others keep theirs to be matched again.
    expect(photoOf(c)).toBeNull();
    expect(photoOf(a)).not.toBeNull();
    expect((await room(s.id, 1)).me.status).toBe("waiting");
    await expect(room(s.id, 2)).rejects.toMatchObject({ status: 403 });
    const [old] = await db
      .select()
      .from(schema.rideParties)
      .where(eq(schema.rideParties.id, before.id));
    expect(old.status).toBe("cancelled");

    // A new person joins, and the remaining two are matched again with new shares.
    await participation.join(s.id, userIds[3], input);
    await matching.match(s.id, a);
    const after = (await room(s.id, 0)).party!;
    expect(after.id).not.toBe(before.id);
    expect(after.status).toBe("forming");
    expect(after.members.every((m) => m.status === "invited")).toBe(true);
    expect(after.plan!.stops.map((x) => x.userId).sort()).toEqual(
      [a, b, userIds[3]].sort(),
    );
  });

  describe("deadlines", () => {
    const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);
    const partyOf = async (sessionId: string) =>
      (
        await db
          .select()
          .from(schema.rideParties)
          .where(eq(schema.rideParties.sessionId, sessionId))
      )[0];
    const seatsOf = async (sessionId: string) =>
      new Map(
        (
          await db
            .select({
              userId: schema.sessionParticipants.userId,
              status: schema.sessionParticipants.status,
              selfie: schema.sessionParticipants.selfieDataUrl,
            })
            .from(schema.sessionParticipants)
            .where(eq(schema.sessionParticipants.sessionId, sessionId))
        ).map((seat) => [seat.userId, seat]),
      );

    it("gives a new group a confirmation deadline", async () => {
      const s = await matchedSession();
      const party = await partyOf(s.id);
      expect(party.confirmBy!.getTime()).toBeGreaterThan(Date.now());
      expect(party.startBy).toBeNull();
    });

    it("releases a group nobody finished confirming", async () => {
      const s = await matchedSession();
      const [a, b, c] = userIds;
      await parties.apply(s.id, a, "confirm");
      const party = await partyOf(s.id);
      expect(await parties.sweep(s.id)).toEqual([]);
      await db
        .update(schema.rideParties)
        .set({ confirmBy: minutesAgo(1) })
        .where(eq(schema.rideParties.id, party.id));

      const events = await parties.sweep(s.id);
      expect(events).toHaveLength(1);
      expect(events[0].memberUserIds[0]).toBe(a);
      expect((await partyOf(s.id)).status).toBe("cancelled");
      const seats = await seatsOf(s.id);
      // The one who confirmed waits again; the others are released, photo deleted.
      expect(seats.get(a)?.status).toBe("waiting");
      expect(seats.get(b)).toMatchObject({ status: "withdrawn", selfie: null });
      expect(seats.get(c)).toMatchObject({ status: "withdrawn", selfie: null });
      expect((await room(s.id, 0)).party).toBeNull();
      // Already swept: nothing more to do.
      expect(await parties.sweep(s.id)).toEqual([]);
    });

    it("returns everyone to the pool when a confirmed group never starts", async () => {
      const s = await matchedSession();
      for (const user of userIds.slice(0, 3))
        await parties.apply(s.id, user, "confirm");
      const party = await partyOf(s.id);
      expect(party.startBy!.getTime()).toBeGreaterThan(Date.now());
      await db
        .update(schema.rideParties)
        .set({ startBy: minutesAgo(1) })
        .where(eq(schema.rideParties.id, party.id));
      await parties.sweep(s.id);
      const seats = await seatsOf(s.id);
      expect(userIds.slice(0, 3).map((u) => seats.get(u)?.status)).toEqual([
        "waiting",
        "waiting",
        "waiting",
      ]);
    });

    it("stops holding members once expired, even before a sweep", async () => {
      const s = await matchedSession();
      const party = await partyOf(s.id);
      await db
        .update(schema.rideParties)
        .set({ confirmBy: minutesAgo(1) })
        .where(eq(schema.rideParties.id, party.id));
      // The expired group no longer blocks joining another room...
      const other = await participation.createGroup(userIds[1], {
        ...input,
        departInMinutes: 0,
      });
      // ...and the later sweep leaves that new seat alone instead of requeueing here.
      await parties.sweep(s.id);
      expect((await seatsOf(s.id)).get(userIds[1])?.status).toBe("withdrawn");
      expect((await seatsOf(other.id)).get(userIds[1])?.status).toBe("waiting");
      await db.delete(schema.sessions).where(eq(schema.sessions.id, other.id));
    });

    it("lets a passenger close a ride the booker never finished", async () => {
      const s = await matchedSession();
      const [a, b] = userIds;
      for (const user of userIds.slice(0, 3))
        await parties.apply(s.id, user, "confirm");
      await parties.apply(s.id, a, "start");
      await expect(parties.apply(s.id, b, "complete")).rejects.toMatchObject({
        code: "delegate_required",
      });
      const party = await partyOf(s.id);
      await db
        .update(schema.rides)
        .set({ startedAt: minutesAgo(31) })
        .where(eq(schema.rides.partyId, party.id));
      expect(await parties.apply(s.id, b, "complete")).toMatchObject({
        partyStatus: "completed",
      });
    });
  });

  it("serializes concurrent commands without corrupting state", async () => {
    const s = await matchedSession();
    const results = await Promise.allSettled(
      userIds.slice(0, 3).map((u) => parties.apply(s.id, u, "confirm")),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect((await room(s.id, 0)).party!.status).toBe("confirmed");
    const rides = await db
      .select()
      .from(schema.rides)
      .where(eq(schema.rides.partyId, (await room(s.id, 0)).party!.id));
    expect(rides).toHaveLength(1);
  });

  it("rejects commands from people without a group", async () => {
    const s = await matchedSession(2);
    await participation.join(s.id, userIds[3], input);
    await expect(
      parties.apply(s.id, userIds[3], "confirm"),
    ).rejects.toMatchObject({ code: "party_not_found" });
  });
});
