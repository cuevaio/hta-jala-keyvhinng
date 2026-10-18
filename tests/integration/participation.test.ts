import { selfieDataUrl } from "../fixtures/selfie";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { MAX_GROUP_SIZE } from "@/modules/sessions/domain/affinity";
import { createParticipationRepository } from "@/modules/sessions/infrastructure/participation.repository";
import { groupAnchors, originFields } from "./group-fixture";

// Opt in explicitly. Only fixtures created by this suite are removed.
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("ride groups and shared sessions", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 5 });
  const db = drizzle(sql, { schema });
  const repo = createParticipationRepository(db);
  const placeId = randomUUID();
  const userIds = Array.from({ length: 3 }, () => randomUUID());
  const crowdIds = Array.from({ length: MAX_GROUP_SIZE }, () => randomUUID());
  let sessionId: string;
  // Own corner of the map: other suites place fixtures near (-12, -77).
  const here = { latitude: -11.5, longitude: -76.5 };
  const input = {
    selfieDataUrl,
    originLabel: "Mi punto de salida",
    originLatitude: here.latitude,
    originLongitude: here.longitude,
    displayName: "Ana",
    destinationLabel: "Mi dirección exacta",
    latitude: -11.62,
    longitude: -76.53,
    delegatePreference: "delegate" as const,
  };
  const intent = {
    olat: here.latitude,
    olng: here.longitude,
    dlat: input.latitude,
    dlng: input.longitude,
    depart: 15 as const,
  };

  beforeAll(async () => {
    await db.insert(schema.places).values({
      id: placeId,
      slug: `test-${placeId}`,
      name: "Integration fixture",
      ...here,
      status: "active",
      isFictional: true,
    });
    await db
      .insert(schema.users)
      .values(
        [...userIds, ...crowdIds].map((id) => ({ id, displayName: "Test" })),
      );
  });
  afterAll(async () => {
    await db
      .delete(schema.sessions)
      .where(inArray(schema.sessions.id, [sessionId].filter(Boolean)));
    await db.delete(schema.places).where(eq(schema.places.id, placeId));
    await db
      .delete(schema.users)
      .where(inArray(schema.users.id, [...userIds, ...crowdIds]));
    await sql.end();
  });

  it("creates a group at a nearby place and joins its creator", async () => {
    const session = await repo.createGroup(userIds[0], {
      ...input,
      departInMinutes: 15,
    });
    sessionId = session.id;
    expect(session.placeId).toBe(placeId);
    expect(session.vehicleCapacity).toBe(3);
    // Rooms are public: no area was given, so neither the address nor its name leaks.
    expect(session.name).toMatch(/^Sala /);
    expect(session.createdByUserId).toBe(userIds[0]);
    expect(session.destinationLabel).toBe("Destino cercano");
    expect(session.destinationLatitude).toBe(input.latitude);
    expect(session.closesAt.getTime() - session.departsAt.getTime()).toBe(
      5 * 60_000,
    );
    const room = await repo.waitingRoom(session.id, userIds[0]);
    const [saved] = await db
      .select()
      .from(schema.sessionParticipants)
      .where(eq(schema.sessionParticipants.id, room.me.id));
    expect(saved.selfieDataUrl).toBe(selfieDataUrl);
    expect(room.me).not.toHaveProperty("selfieDataUrl");
    expect(room.participants[0]).not.toHaveProperty("selfieDataUrl");
    expect(room.me.originLabel).toBe(input.originLabel);
    expect(room.participants).toHaveLength(1);
  });

  it("finds that group only for riders it fits", async () => {
    const found = await repo.search(intent);
    expect(found.map((g) => g.id)).toContain(sessionId);
    const group = found.find((g) => g.id === sessionId)!;
    expect(group.waitingCount).toBe(1);
    expect(group.affinity.pickupMeters).toBeLessThan(10);
    // Far-off destination, far-off start, and a much later departure each miss.
    expect(
      (await repo.search({ ...intent, dlat: -11.9 })).map((g) => g.id),
    ).not.toContain(sessionId);
    expect(
      (await repo.search({ ...intent, olat: -11.3 })).map((g) => g.id),
    ).not.toContain(sessionId);
    expect(
      (await repo.search({ ...intent, depart: 60 })).map((g) => g.id),
    ).not.toContain(sessionId);
  });

  it("starts accounts with S/ 5.00 and rejects joins without credit for one ride", async () => {
    const credit = (minor: number) =>
      db
        .update(schema.users)
        .set({ creditBalanceMinor: minor })
        .where(eq(schema.users.id, userIds[2]));
    const [fresh] = await db
      .select({ creditBalanceMinor: schema.users.creditBalanceMinor })
      .from(schema.users)
      .where(eq(schema.users.id, userIds[2]));
    expect(fresh.creditBalanceMinor).toBe(500);
    await credit(99);
    try {
      await expect(
        repo.join(sessionId, userIds[2], input),
      ).rejects.toMatchObject({ status: 402, code: "insufficient_credit" });
    } finally {
      await credit(500);
    }
  });

  it("concurrent duplicate joins preserve one participant and exact destination", async () => {
    const joined = await Promise.all(
      Array.from({ length: 5 }, () => repo.join(sessionId, userIds[0], input)),
    );
    expect(new Set(joined.map((p) => p.id)).size).toBe(1);
    expect(joined[0].latitude).toBe(input.latitude);
    expect(joined[0].destinationLabel).toBe(input.destinationLabel);
    expect(joined[0].originLabel).toBe(input.originLabel);
  });

  it("rejects a rider whose start or destination does not fit the group", async () => {
    await expect(
      repo.join(sessionId, userIds[1], { ...input, originLatitude: -11.3 }),
    ).rejects.toMatchObject({ code: "group_mismatch" });
    await expect(
      repo.join(sessionId, userIds[1], { ...input, latitude: -11.9 }),
    ).rejects.toMatchObject({ code: "group_mismatch" });
  });

  it("independent participants see the same roster without others' destinations", async () => {
    await repo.join(sessionId, userIds[1], {
      ...input,
      displayName: "Luis",
      delegatePreference: "passenger",
    });
    const [a, b] = await Promise.all(
      userIds.slice(0, 2).map((userId) => repo.waitingRoom(sessionId, userId)),
    );
    expect(a.participants).toEqual(b.participants);
    expect(a.participants).toHaveLength(2);
    expect(a.me.id).not.toBe(b.me.id);
    expect(a.participants[0]).not.toHaveProperty("latitude");
    expect(a.participants[0]).not.toHaveProperty("destinationLabel");
    expect(a.participants[0]).not.toHaveProperty("originLabel");
    await expect(repo.waitingRoom(sessionId, userIds[2])).rejects.toMatchObject(
      { status: 403 },
    );
  });

  it("reports the group a person can resume", async () => {
    expect((await repo.activeFor(userIds[0]))?.sessionId).toBe(sessionId);
    expect(await repo.activeFor(userIds[2])).toBeNull();
  });

  it("keeps a person in one waiting group at a time", async () => {
    const second = await repo.createGroup(userIds[2], {
      ...input,
      departInMinutes: 30,
    });
    // Starting another group while waiting in this one releases the first seat.
    await repo.join(sessionId, userIds[2], input);
    const [back] = await db
      .select()
      .from(schema.sessionParticipants)
      .where(eq(schema.sessionParticipants.sessionId, sessionId));
    expect(back).toBeDefined();
    const rows = await db
      .select()
      .from(schema.sessionParticipants)
      .where(eq(schema.sessionParticipants.userId, userIds[2]));
    expect(rows.filter((r) => r.status === "waiting")).toHaveLength(1);
    expect(rows.find((r) => r.sessionId === second.id)?.status).toBe(
      "withdrawn",
    );
    expect((await repo.activeFor(userIds[2]))?.sessionId).toBe(sessionId);
    await db.delete(schema.sessions).where(eq(schema.sessions.id, second.id));
    await db
      .delete(schema.sessionParticipants)
      .where(eq(schema.sessionParticipants.userId, userIds[2]));
  });

  it("does not move a matched participant back to waiting", async () => {
    await db
      .update(schema.sessionParticipants)
      .set({ status: "matched" })
      .where(eq(schema.sessionParticipants.userId, userIds[0]));
    await expect(repo.join(sessionId, userIds[0], input)).rejects.toMatchObject(
      { code: "already_matched" },
    );
    await db
      .update(schema.sessionParticipants)
      .set({ status: "waiting" })
      .where(eq(schema.sessionParticipants.userId, userIds[0]));
  });

  it("refuses new people once a group is full", async () => {
    const [full] = await db
      .insert(schema.sessions)
      .values({
        ...groupAnchors,
        departsAt: new Date(),
        closesAt: new Date(Date.now() + 60000),
        opensAt: new Date(Date.now() - 1000),
      })
      .returning();
    await db.insert(schema.sessionParticipants).values(
      crowdIds.map((userId) => ({
        sessionId: full.id,
        userId,
        ...originFields,
        destinationLabel: "Crowd",
        latitude: -12.1,
        longitude: -77.03,
      })),
    );
    await expect(
      repo.join(full.id, userIds[2], {
        ...input,
        ...originFields,
        latitude: -12.1,
        longitude: -77.03,
      }),
    ).rejects.toMatchObject({ code: "group_full" });
    expect(
      (
        await repo.search({
          olat: -12,
          olng: -77,
          dlat: -12.1,
          dlng: -77.03,
          depart: 0,
        })
      ).map((g) => g.id),
    ).not.toContain(full.id);
    await db.delete(schema.sessions).where(eq(schema.sessions.id, full.id));
  });

  it("rejects closed and future sessions", async () => {
    await db
      .update(schema.sessions)
      .set({ status: "closed" })
      .where(eq(schema.sessions.id, sessionId));
    await expect(repo.join(sessionId, userIds[2], input)).rejects.toMatchObject(
      { code: "session_unavailable" },
    );
    await db
      .update(schema.sessions)
      .set({ status: "open", opensAt: new Date(Date.now() + 60000) })
      .where(eq(schema.sessions.id, sessionId));
    await expect(repo.join(sessionId, userIds[2], input)).rejects.toMatchObject(
      { code: "session_unavailable" },
    );
  });

  it("rejects expired groups and hides them from search", async () => {
    await db
      .update(schema.sessions)
      .set({
        opensAt: new Date(Date.now() - 7200000),
        closesAt: new Date(Date.now() - 1000),
      })
      .where(eq(schema.sessions.id, sessionId));
    await expect(repo.join(sessionId, userIds[2], input)).rejects.toMatchObject(
      { code: "session_unavailable" },
    );
    expect((await repo.waitingRoom(sessionId, userIds[1])).acceptingJoins).toBe(
      false,
    );
    expect((await repo.search(intent)).map((g) => g.id)).not.toContain(
      sessionId,
    );
  });

  it("rejects joins to groups anchored on an inactive place", async () => {
    await db
      .update(schema.sessions)
      .set({
        opensAt: new Date(Date.now() - 1000),
        closesAt: new Date(Date.now() + 60000),
      })
      .where(eq(schema.sessions.id, sessionId));
    await db
      .update(schema.places)
      .set({ status: "inactive" })
      .where(eq(schema.places.id, placeId));
    await expect(repo.join(sessionId, userIds[2], input)).rejects.toMatchObject(
      { code: "place_unavailable" },
    );
  });
});
