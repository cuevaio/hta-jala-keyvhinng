import { randomUUID } from "node:crypto";
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
  const eventId = randomUUID();
  const userIds = Array.from({ length: 4 }, () => randomUUID());
  const input = {
    displayName: "Lifecycle fixture",
    destinationLabel: "Fixture destination",
    latitude: -12.1,
    longitude: -77.03,
    delegatePreference: "passenger" as "delegate" | "passenger",
  };

  /** A fresh session where the first `count` users are matched into one party. */
  async function matchedSession(count = 3) {
    const [session] = await db
      .insert(schema.sessions)
      .values({
        eventId,
        name: "Lifecycle test",
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
    await db.insert(schema.events).values({
      id: eventId,
      slug: `lifecycle-${eventId}`,
      name: "Lifecycle fixture",
      venueName: "Fixture venue",
      venueLatitude: -12,
      venueLongitude: -77,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 86400000),
      status: "active",
      isFictional: true,
    });
    await db
      .insert(schema.users)
      .values(userIds.map((id) => ({ id, displayName: "Lifecycle fixture" })));
  });
  afterAll(async () => {
    await db.delete(schema.events).where(eq(schema.events.id, eventId));
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    await sql.end();
  });

  it("runs confirm → start → complete and books the ride record", async () => {
    const s = await matchedSession();
    const [a, b, c] = userIds;
    expect(await parties.apply(s.id, a, "confirm")).toEqual({
      partyStatus: "forming",
    });
    expect(await parties.apply(s.id, a, "confirm")).toEqual({
      partyStatus: "forming",
    }); // idempotent retry
    await parties.apply(s.id, b, "confirm");
    expect(await parties.apply(s.id, c, "confirm")).toEqual({
      partyStatus: "confirmed",
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
    await parties.apply(s.id, a, "complete");
    const party = (await room(s.id, 2)).party!;
    expect(party.status).toBe("completed");
    const [ride] = await db
      .select()
      .from(schema.rides)
      .where(eq(schema.rides.partyId, party.id));
    expect(ride.status).toBe("completed");
    expect(ride.startedAt).not.toBeNull();
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
