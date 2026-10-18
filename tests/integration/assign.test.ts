import { selfieDataUrl } from "../fixtures/selfie";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { createParticipationRepository } from "@/modules/sessions/infrastructure/participation.repository";

// Opt in explicitly. Only fixtures created by this suite are removed.
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("assigning riders to rooms", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 8 });
  const db = drizzle(sql, { schema });
  const repo = createParticipationRepository(db);
  const userIds = Array.from({ length: 6 }, () => randomUUID());
  // Own corner of the map: other suites place fixtures elsewhere.
  const here = { latitude: -10.5, longitude: -75.5 };
  const ride = (
    overrides: Partial<{ departInMinutes: 0 | 15 | 30 | 60 }> = {},
  ) => ({
    selfieDataUrl,
    originLabel: "Salida de prueba",
    originLatitude: here.latitude,
    originLongitude: here.longitude,
    destinationLabel: "Destino de prueba",
    latitude: -10.55,
    longitude: -75.52,
    delegatePreference: "passenger" as const,
    departInMinutes: 0 as const,
    ...overrides,
  });
  const waitingIn = async (sessionId: string) =>
    db
      .select({ userId: schema.sessionParticipants.userId })
      .from(schema.sessionParticipants)
      .where(
        and(
          eq(schema.sessionParticipants.sessionId, sessionId),
          eq(schema.sessionParticipants.status, "waiting"),
        ),
      );

  beforeAll(async () => {
    await db
      .insert(schema.users)
      .values(userIds.map((id) => ({ id, displayName: "Test" })));
  });
  afterAll(async () => {
    await db
      .delete(schema.sessions)
      .where(inArray(schema.sessions.createdByUserId, userIds));
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    await sql.end();
  });

  it("opens a room when none fits, then puts the next rider with the same route in it", async () => {
    const first = await repo.assign(userIds[0], ride());
    expect(first.created).toBe(true);
    expect(first.session.createdByUserId).toBe(userIds[0]);
    expect(first.session.name).toMatch(/^Sala /);
    expect(await repo.opened(first.session.id, userIds[0])).toBe(true);

    const second = await repo.assign(userIds[1], ride());
    expect(second.created).toBe(false);
    expect(second.session.id).toBe(first.session.id);
    expect(await repo.opened(first.session.id, userIds[1])).toBe(false);
    expect(await waitingIn(first.session.id)).toHaveLength(2);
  });

  it("keeps a rider who asks again in the room they are already waiting in", async () => {
    const before = await repo.activeFor(userIds[1]);
    const again = await repo.assign(userIds[1], ride());
    expect(again.created).toBe(false);
    expect(again.session.id).toBe(before?.sessionId);
    expect((await repo.activeFor(userIds[1]))?.mine).toBe(false);
  });

  it("does not park someone leaving now in a room that leaves much later", async () => {
    const later = await repo.assign(userIds[2], ride({ departInMinutes: 30 }));
    expect(later.created).toBe(true);
    const now = await repo.assign(userIds[3], ride());
    expect(now.session.id).not.toBe(later.session.id);
  });

  it("puts two riders asking at the same moment in one room", async () => {
    const far = { originLatitude: -10.9, originLongitude: -75.9 };
    const both = await Promise.all(
      [userIds[4], userIds[5]].map((id) =>
        repo.assign(id, {
          ...ride(),
          ...far,
          latitude: -10.95,
          longitude: -75.92,
        }),
      ),
    );
    expect(both.filter((r) => r.created)).toHaveLength(1);
    expect(both[0].session.id).toBe(both[1].session.id);
  });
});
