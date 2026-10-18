import { selfieDataUrl } from "../fixtures/selfie";
import { randomUUID } from "node:crypto";
import { groupAnchors, originFields } from "./group-fixture";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
describe.skipIf(!url)("background matching", () => {
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
    displayName: "Background fixture",
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

  beforeAll(async () => {
    await db.insert(schema.places).values({
      id: placeId,
      slug: `background-${placeId}`,
      name: "Background fixture",
      latitude: -12,
      longitude: -77,
      status: "active",
      isFictional: true,
    });
    await db
      .insert(schema.users)
      .values(userIds.map((id) => ({ id, displayName: "Background fixture" })));
  });
  // Earlier tests leave these accounts in live parties, which would block joining.
  beforeEach(async () => {
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.placeId, placeId));
  });
  afterAll(async () => {
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.placeId, placeId));
    await db.delete(schema.places).where(eq(schema.places.id, placeId));
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    await sql.end();
  });

  it("forms a group as soon as a compatible person joins", async () => {
    const s = await session();
    await join(s.id, 1);
    expect(await matching.matchInBackground(s.id, userIds[0])).toMatchObject({
      createdPartyCount: 0,
    });
    await participation.join(s.id, userIds[1], input);
    const outcome = await matching.matchInBackground(s.id, userIds[1]);
    expect(outcome?.createdPartyCount).toBe(1);
    expect(outcome?.partyUserIds[0].sort()).toEqual(userIds.slice(0, 2).sort());
    const room = await participation.waitingRoom(s.id, userIds[0]);
    expect(room.party?.status).toBe("forming");
  });

  it("settles concurrent background rounds into one group without errors", async () => {
    const s = await session();
    await join(s.id, 3);
    const outcomes = await Promise.all(
      userIds.slice(0, 3).map((u) => matching.matchInBackground(s.id, u)),
    );
    expect(outcomes.every((o) => o !== null)).toBe(true);
    expect(outcomes.reduce((n, o) => n + (o?.createdPartyCount ?? 0), 0)).toBe(
      1,
    );
  });

  it("re-matches the people left when a party dissolves", async () => {
    const s = await session();
    await join(s.id, 3);
    await matching.match(s.id, userIds[0]);
    const { event } = await parties.apply(s.id, userIds[2], "leave");
    expect(event).toMatchObject({ kind: "dissolved", actorUserId: userIds[2] });
    const outcome = await matching.matchInBackground(s.id, userIds[0]);
    expect(outcome?.partyUserIds[0].sort()).toEqual(userIds.slice(0, 2).sort());
  });
});
