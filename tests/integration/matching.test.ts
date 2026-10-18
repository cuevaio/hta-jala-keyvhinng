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
import {
  RoutingError,
  type RoutingProvider,
} from "@/modules/routing/domain/routing-provider";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("durable matching", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 8 });
  const db = drizzle(sql, { schema });
  const participation = createParticipationRepository(db);
  const repository = createMatchingRepository(db);
  const placeId = randomUUID();
  const userIds = Array.from({ length: 15 }, () => randomUUID());
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
  const app = createMatchingApplication(
    repository,
    createRoadMatchingService(routing),
    "fixture",
  );
  const input = {
    selfieDataUrl,
    ...originFields,
    displayName: "Matching fixture",
    destinationLabel: "Exact fixture destination",
    latitude: -12.1,
    longitude: -77.03,
    delegatePreference: "passenger" as "delegate" | "passenger",
  };
  async function fixture(delegates = true, count = 3) {
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
        delegatePreference: delegates && i === 0 ? "delegate" : "passenger",
      });
    return session;
  }
  beforeAll(async () => {
    await db.insert(schema.places).values({
      id: placeId,
      slug: `match-${placeId}`,
      name: "Matching fixture",
      latitude: -12,
      longitude: -77,
      status: "active",
      isFictional: true,
    });
    await db
      .insert(schema.users)
      .values(userIds.map((id) => ({ id, displayName: "Matching fixture" })));
  });
  afterAll(async () => {
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.placeId, placeId));
    await db.delete(schema.places).where(eq(schema.places.id, placeId));
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    await sql.end();
  });
  it("persists one immutable route and shares it only with its members", async () => {
    const session = await fixture();
    expect(await app.match(session.id, userIds[0])).toMatchObject({
      createdPartyCount: 1,
    });
    const rooms = await Promise.all(
      userIds
        .slice(0, 3)
        .map((id) => participation.waitingRoom(session.id, id)),
    );
    expect(rooms[0].party).toEqual(rooms[1].party);
    expect(rooms[1].party).toEqual(rooms[2].party);
    // Photos travel by their own URL, never inside the polled room.
    expect(JSON.stringify(rooms[0])).not.toContain(selfieDataUrl);
    const members = rooms[0].party!.members;
    expect(
      members.every((m) =>
        m.selfieUrl?.startsWith(
          `/api/sessions/${session.id}/participants/${m.participantId}/selfie?v=`,
        ),
      ),
    ).toBe(true);
    for (const m of members)
      expect(
        await participation.selfieFor(session.id, userIds[2], m.participantId),
      ).toBe(selfieDataUrl);
    const plan = rooms[0].party!.plan!;
    expect(plan.routingSource).toBe("fixture");
    expect(plan.stops).toHaveLength(3);
    expect(plan.stops.reduce((n, s) => n + s.fareShareBps, 0)).toBe(10000);
    expect(plan.stops.filter((s) => s.role === "delegate")).toHaveLength(1);
    expect(
      plan.stops.every((s) => s.destinationLabel === input.destinationLabel),
    ).toBe(true);
    expect(rooms.every((r) => r.me.status === "matched")).toBe(true);
    await participation.join(session.id, userIds[3], input);
    const outsider = await participation.waitingRoom(session.id, userIds[3]);
    expect(outsider.party).toBeNull();
    expect(JSON.stringify(outsider)).not.toContain(selfieDataUrl);
    expect(
      await participation.selfieFor(
        session.id,
        userIds[3],
        members[0].participantId,
      ),
    ).toBeNull();
    await expect(app.match(session.id, userIds[4])).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      participation.join(session.id, userIds[0], input),
    ).rejects.toMatchObject({ code: "already_matched" });
    expect(await app.match(session.id, userIds[0])).toMatchObject({
      createdPartyCount: 0,
      alreadyMatched: true,
    });
    expect(
      (await participation.waitingRoom(session.id, userIds[0])).party,
    ).toEqual(rooms[0].party);
  });
  it("concurrent rounds cannot assign participants twice", async () => {
    const session = await fixture();
    const outcomes = await Promise.all(
      userIds.slice(0, 3).map((id) => app.match(session.id, id)),
    );
    expect(outcomes.reduce((n, o) => n + o.createdPartyCount, 0)).toBe(1);
    const parties = await db
      .select()
      .from(schema.rideParties)
      .where(eq(schema.rideParties.sessionId, session.id));
    expect(parties).toHaveLength(1);
    const members = await db
      .select()
      .from(schema.ridePartyMembers)
      .where(eq(schema.ridePartyMembers.partyId, parties[0].id));
    expect(members).toHaveLength(3);
  });
  it("discards a stale snapshot after an edit without persisting any group", async () => {
    const session = await fixture();
    const snapshot = await repository.snapshot(session.id, userIds[0]);
    if (snapshot.kind !== "waiting") throw new Error("Expected waiting");
    await participation.join(session.id, userIds[1], {
      ...input,
      longitude: -77.04,
    });
    await expect(
      repository.commit(session.id, userIds[0], snapshot, []),
    ).rejects.toMatchObject({ code: "matching_snapshot_changed" });
    expect(
      (await participation.waitingRoom(session.id, userIds[0])).me.status,
    ).toBe("waiting");
  });
  it("routing outages leave everyone waiting and permit a later retry", async () => {
    const session = await fixture();
    const broken = createMatchingApplication(
      repository,
      createRoadMatchingService({
        ...routing,
        estimateMatrix: async () => {
          throw new RoutingError("offline");
        },
      }),
      "fixture",
    );
    await expect(broken.match(session.id, userIds[0])).rejects.toThrow(
      "offline",
    );
    const room = await participation.waitingRoom(session.id, userIds[0]);
    expect(room.me.status).toBe("waiting");
    expect(room.party).toBeNull();
    expect(await app.match(session.id, userIds[0])).toMatchObject({
      createdPartyCount: 1,
    });
  });
  it("keeps a pool without volunteers open and waiting", async () => {
    const session = await fixture(false);
    expect(await app.match(session.id, userIds[0])).toMatchObject({
      createdPartyCount: 0,
    });
    expect(
      (await participation.waitingRoom(session.id, userIds[0])).me.status,
    ).toBe("waiting");
  });
  it("rejects expired sessions without assignment", async () => {
    const session = await fixture();
    await db
      .update(schema.sessions)
      .set({
        opensAt: new Date(Date.now() - 60000),
        closesAt: new Date(Date.now() - 1000),
      })
      .where(eq(schema.sessions.id, session.id));
    await expect(app.match(session.id, userIds[0])).rejects.toMatchObject({
      code: "session_unavailable",
    });
  });
  it("rejects a match that crosses the deadline before commit", async () => {
    const session = await fixture();
    const delayed = createMatchingApplication(
      {
        ...repository,
        commit: async (...args) => {
          expect(args[3]).toHaveLength(1);
          await db
            .update(schema.sessions)
            .set({ closesAt: new Date(Date.now() - 1) })
            .where(eq(schema.sessions.id, session.id));
          return repository.commit(...args);
        },
      },
      createRoadMatchingService(routing),
      "fixture",
    );
    await expect(delayed.match(session.id, userIds[0])).rejects.toMatchObject({
      code: "session_unavailable",
    });
    expect(
      await db
        .select()
        .from(schema.rideParties)
        .where(eq(schema.rideParties.sessionId, session.id)),
    ).toHaveLength(0);
    const room = await participation.waitingRoom(session.id, userIds[0]);
    expect(room.acceptingJoins).toBe(false);
    expect(room.me.status).toBe("waiting");
    expect(Number.isFinite(Date.parse(room.serverNow))).toBe(true);
  });
  it("includes a later requester and a volunteer beyond the oldest batch", async () => {
    const session = await fixture(false, 14);
    await participation.join(session.id, userIds[13], {
      ...input,
      delegatePreference: "delegate",
    });
    const snapshot = await repository.snapshot(session.id, userIds[12]);
    if (snapshot.kind !== "waiting") throw new Error("Expected waiting");
    expect(snapshot.candidates).toHaveLength(12);
    expect(snapshot.candidates.some((c) => c.userId === userIds[12])).toBe(
      true,
    );
    expect(
      snapshot.candidates.some(
        (c) => c.userId === userIds[13] && c.delegatePreference === "delegate",
      ),
    ).toBe(true);
  });
  it("allows a join during routing and rejects the resulting stale plan", async () => {
    const session = await fixture();
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const delayed = createMatchingApplication(
      repository,
      createRoadMatchingService({
        ...routing,
        estimateMatrix: async (points) => {
          started();
          await gate;
          return routing.estimateMatrix!(points);
        },
      }),
      "fixture",
    );
    const running = delayed.match(session.id, userIds[0]);
    await ready;
    try {
      await participation.join(session.id, userIds[3], input);
    } finally {
      release();
    }
    await expect(running).rejects.toMatchObject({
      code: "matching_snapshot_changed",
    });
    expect(
      (await participation.waitingRoom(session.id, userIds[0])).party,
    ).toBeNull();
    expect(await app.match(session.id, userIds[0])).toMatchObject({
      createdPartyCount: 1,
    });
  });
  it("rolls back every party and assignment if persistence fails partway through", async () => {
    const session = await fixture(true, 5);
    await participation.join(session.id, userIds[3], {
      ...input,
      delegatePreference: "delegate",
    });
    const failing = createMatchingApplication(
      {
        ...repository,
        commit: async (...args) => {
          expect(args[3]).toHaveLength(2);
          args[3][1].stops[0].fareShareBps = 10001; // Force a real DB constraint failure on the second party.
          return repository.commit(...args);
        },
      },
      createRoadMatchingService(routing),
      "fixture",
    );
    await expect(failing.match(session.id, userIds[0])).rejects.toThrow();
    expect(
      await db
        .select()
        .from(schema.rideParties)
        .where(eq(schema.rideParties.sessionId, session.id)),
    ).toHaveLength(0);
    const participants = await db
      .select()
      .from(schema.sessionParticipants)
      .where(eq(schema.sessionParticipants.sessionId, session.id));
    expect(participants.every((p) => p.status === "waiting")).toBe(true);
  });
});
