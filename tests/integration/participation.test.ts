import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { createParticipationRepository } from "@/modules/sessions/infrastructure/participation.repository";

// Opt in explicitly. Only fixtures created by this suite are removed.
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("persisted shared sessions", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 5 });
  const db = drizzle(sql, { schema });
  const repo = createParticipationRepository(db);
  const eventId = randomUUID();
  const userIds = [randomUUID(), randomUUID(), randomUUID()];
  let sessionId: string;
  const input = {
    displayName: "Ana",
    destinationLabel: "Mi dirección exacta",
    latitude: -12.12,
    longitude: -77.03,
    delegatePreference: "delegate" as const,
  };

  beforeAll(async () => {
    await db.insert(schema.events).values({
      id: eventId,
      slug: `test-${eventId}`,
      name: "Integration fixture",
      venueName: "Test",
      venueLatitude: -12,
      venueLongitude: -77,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 86400000),
      status: "active",
      isFictional: true,
    });
    await db
      .insert(schema.users)
      .values(userIds.map((id) => ({ id, displayName: "Test" })));
  });
  afterAll(async () => {
    await db.delete(schema.events).where(eq(schema.events.id, eventId));
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    await sql.end();
  });
  it("simultaneous session creation reuses one expiring pool", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => repo.openForEvent(eventId)),
    );
    expect(new Set(results.map((s) => s.id)).size).toBe(1);
    sessionId = results[0].id;
    expect(results[0].vehicleCapacity).toBe(3);
    expect(results[0].closesAt.getTime() - results[0].opensAt.getTime()).toBe(
      7200000,
    );
  });
  it("concurrent duplicate joins preserve one participant and exact destination", async () => {
    const joined = await Promise.all(
      Array.from({ length: 5 }, () => repo.join(sessionId, userIds[0], input)),
    );
    expect(new Set(joined.map((p) => p.id)).size).toBe(1);
    expect(joined[0].latitude).toBe(input.latitude);
    expect(joined[0].destinationLabel).toBe(input.destinationLabel);
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
    await expect(repo.waitingRoom(sessionId, userIds[2])).rejects.toMatchObject(
      { status: 403 },
    );
  });
  it("does not move a matched participant back to waiting", async () => {
    await db
      .update(schema.sessionParticipants)
      .set({ status: "matched" })
      .where(eq(schema.sessionParticipants.userId, userIds[0]));
    await expect(repo.join(sessionId, userIds[0], input)).rejects.toMatchObject(
      { code: "already_matched" },
    );
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
  it("rejects expiry and replaces expired pools", async () => {
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
    expect((await repo.openForEvent(eventId)).id).not.toBe(sessionId);
  });
  it("rejects cancelled events", async () => {
    await db
      .update(schema.events)
      .set({ status: "cancelled" })
      .where(eq(schema.events.id, eventId));
    await expect(repo.openForEvent(eventId)).rejects.toMatchObject({
      code: "event_unavailable",
    });
  });
});
