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
describe.skipIf(!url)("one waiting seat per account", () => {
  // Enough connections that the requests really run at the same time.
  const sql = postgres(url ?? "postgres://unused", { max: 8 });
  const db = drizzle(sql, { schema });
  const repo = createParticipationRepository(db);
  const userId = randomUUID();
  const sessionIds: string[] = [];
  // Own corner of the map, away from other suites' fixtures.
  const ride = (n: number) => ({
    selfieDataUrl,
    displayName: "Ana",
    originLabel: "Salida",
    originLatitude: -9.5,
    originLongitude: -74.5,
    destinationLabel: `Destino ${n}`,
    latitude: -9.6 - n * 0.05,
    longitude: -74.52,
    delegatePreference: "passenger" as const,
    departInMinutes: 0 as const,
  });

  beforeAll(async () => {
    await db.insert(schema.users).values({ id: userId, displayName: "Ana" });
  });
  afterAll(async () => {
    const rows = await db
      .select({ id: schema.sessionParticipants.sessionId })
      .from(schema.sessionParticipants)
      .where(eq(schema.sessionParticipants.userId, userId));
    sessionIds.push(...rows.map((r) => r.id));
    if (sessionIds.length)
      await db
        .delete(schema.sessions)
        .where(inArray(schema.sessions.id, sessionIds));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    await sql.end();
  });

  it("keeps only the newest seat when one account creates rooms concurrently", async () => {
    const results = await Promise.allSettled(
      [1, 2, 3, 4].map((n) => repo.createGroup(userId, ride(n))),
    );
    // Requests queue on the account instead of failing.
    expect(results.map((r) => r.status)).toEqual(Array(4).fill("fulfilled"));
    const waiting = await db
      .select({ sessionId: schema.sessionParticipants.sessionId })
      .from(schema.sessionParticipants)
      .where(
        and(
          eq(schema.sessionParticipants.userId, userId),
          eq(schema.sessionParticipants.status, "waiting"),
        ),
      );
    expect(waiting).toHaveLength(1);
  });

  it("refuses a second waiting seat at the database level", async () => {
    const [seat] = await db
      .select()
      .from(schema.sessionParticipants)
      .where(
        and(
          eq(schema.sessionParticipants.userId, userId),
          eq(schema.sessionParticipants.status, "waiting"),
        ),
      );
    const [other] = await db
      .select({ id: schema.sessionParticipants.id })
      .from(schema.sessionParticipants)
      .where(
        and(
          eq(schema.sessionParticipants.userId, userId),
          eq(schema.sessionParticipants.status, "withdrawn"),
        ),
      )
      .limit(1);
    expect(seat).toBeDefined();
    await expect(
      db
        .update(schema.sessionParticipants)
        .set({ status: "waiting" })
        .where(eq(schema.sessionParticipants.id, other.id)),
    ).rejects.toThrow();
  });
});
