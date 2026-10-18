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
import { createPartyMessageRepository } from "@/modules/parties/infrastructure/party-message.repository";
import type { RoutingProvider } from "@/modules/routing/domain/routing-provider";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("room revision", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 8 });
  const db = drizzle(sql, { schema });
  const participation = createParticipationRepository(db);
  const parties = createPartyRepository(db);
  const chat = createPartyMessageRepository(db);
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
    displayName: "Revision fixture",
    destinationLabel: "Fixture destination",
    latitude: -12.1,
    longitude: -77.03,
    delegatePreference: "passenger" as "delegate" | "passenger",
  };

  async function session() {
    const [row] = await db
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
    return row;
  }

  async function join(sessionId: string, count: number) {
    for (let i = 0; i < count; i++)
      await participation.join(sessionId, userIds[i], {
        ...input,
        delegatePreference: i === 0 ? "delegate" : "passenger",
      });
  }

  const revisionOf = (sessionId: string, userId = userIds[0]) =>
    participation.roomRevision(sessionId, userId);

  beforeAll(async () => {
    await db.insert(schema.places).values({
      id: placeId,
      slug: `revision-${placeId}`,
      name: "Revision fixture",
      latitude: -12,
      longitude: -77,
      status: "active",
      isFictional: true,
    });
    await db
      .insert(schema.users)
      .values(userIds.map((id) => ({ id, displayName: "Revision fixture" })));
  });
  afterAll(async () => {
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.placeId, placeId));
    await db.delete(schema.places).where(eq(schema.places.id, placeId));
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    await sql.end();
  });

  it("changes with every write a member can see, and only then", async () => {
    const s = await session();
    await join(s.id, 2);
    let last = await revisionOf(s.id);
    const changed = async () => {
      const next = await revisionOf(s.id);
      const moved = next > last;
      last = next;
      return moved;
    };

    expect((await participation.waitingRoom(s.id, userIds[0])).revision).toBe(
      last,
    );
    await participation.waitingRoom(s.id, userIds[1]);
    expect(await changed()).toBe(false);

    await matching.match(s.id, userIds[0]);
    expect(await changed()).toBe(true);

    await chat.post(s.id, userIds[1], "Ya llegué.");
    expect(await changed()).toBe(true);

    await parties.apply(s.id, userIds[0], "confirm");
    expect(await changed()).toBe(true);
    // Confirming twice is a no-op and leaves the room as it was.
    await parties.apply(s.id, userIds[0], "confirm");
    expect(await changed()).toBe(false);

    await parties.apply(s.id, userIds[1], "leave");
    expect(await changed()).toBe(true);
  });

  it("marks the room someone left by joining another one", async () => {
    const first = await session();
    await join(first.id, 2);
    const before = await revisionOf(first.id);
    const second = await session();
    await participation.join(second.id, userIds[1], input);
    expect(await revisionOf(first.id)).toBeGreaterThan(before);
  });

  it("refuses people who are not in the room", async () => {
    const s = await session();
    await join(s.id, 1);
    await expect(revisionOf(s.id, userIds[3])).rejects.toMatchObject({
      status: 403,
    });
  });

  it("does not deadlock a chat post against a concurrent leave", async () => {
    for (let round = 0; round < 5; round++) {
      const s = await session();
      await join(s.id, 3);
      await matching.match(s.id, userIds[0]);
      const results = await Promise.allSettled([
        chat.post(s.id, userIds[0], "Hola"),
        parties.apply(s.id, userIds[1], "leave"),
        chat.post(s.id, userIds[2], "Hola"),
      ]);
      expect(results[1].status).toBe("fulfilled");
      // A post ordered after the leave is refused, never left waiting on a lock.
      for (const r of results)
        if (r.status === "rejected")
          expect(["party_not_found", "chat_closed"]).toContain(r.reason.code);
    }
  });
});
