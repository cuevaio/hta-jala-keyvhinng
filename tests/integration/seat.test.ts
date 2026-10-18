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
describe.skipIf(!url)("changing a waiting seat", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 3 });
  const db = drizzle(sql, { schema });
  const repo = createParticipationRepository(db);
  const [ana, beto] = [randomUUID(), randomUUID()];
  let sessionId = "";
  // Own corner of the map, away from other suites' fixtures.
  const ride = {
    selfieDataUrl,
    displayName: "Ana",
    originLabel: "Salida",
    originLatitude: -8.5,
    originLongitude: -73.5,
    destinationLabel: "Destino",
    latitude: -8.6,
    longitude: -73.52,
    delegatePreference: "passenger" as const,
  };
  const seatOf = async (userId: string) =>
    (
      await db
        .select()
        .from(schema.sessionParticipants)
        .where(
          and(
            eq(schema.sessionParticipants.sessionId, sessionId),
            eq(schema.sessionParticipants.userId, userId),
          ),
        )
    )[0];

  beforeAll(async () => {
    await db.insert(schema.users).values([
      { id: ana, displayName: "Ana" },
      { id: beto, displayName: "Beto" },
    ]);
    const room = await repo.createGroup(ana, { ...ride, departInMinutes: 0 });
    sessionId = room.id;
    await repo.join(sessionId, beto, { ...ride, displayName: "Beto" });
  });
  afterAll(async () => {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
    await db.delete(schema.users).where(inArray(schema.users.id, [ana, beto]));
    await sql.end();
  });

  it("lets a passenger volunteer to book, so the pair can form a group", async () => {
    const before = await db
      .select({ revision: schema.sessions.revision })
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId));
    expect(await repo.updateSeat(sessionId, beto, "offer_to_book")).toEqual({
      changed: true,
    });
    expect((await seatOf(beto)).delegatePreference).toBe("delegate");
    const after = await db
      .select({ revision: schema.sessions.revision })
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId));
    expect(after[0].revision).toBeGreaterThan(before[0].revision);
  });

  it("withdraws a waiting seat once, then does nothing", async () => {
    expect(await repo.updateSeat(sessionId, ana, "withdraw")).toEqual({
      changed: true,
    });
    expect((await seatOf(ana)).status).toBe("withdrawn");
    expect(await repo.updateSeat(sessionId, ana, "withdraw")).toEqual({
      changed: false,
    });
    await expect(
      repo.updateSeat(sessionId, ana, "offer_to_book"),
    ).rejects.toMatchObject({ code: "not_waiting" });
  });

  it("leaves seats in a group to the group's own commands", async () => {
    await db
      .update(schema.sessionParticipants)
      .set({ status: "matched" })
      .where(eq(schema.sessionParticipants.userId, beto));
    await expect(
      repo.updateSeat(sessionId, beto, "withdraw"),
    ).rejects.toMatchObject({ code: "already_matched" });
  });
});
