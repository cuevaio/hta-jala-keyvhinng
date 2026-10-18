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
describe.skipIf(!url)("party chat", () => {
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
    displayName: "Chat fixture",
    destinationLabel: "Fixture destination",
    latitude: -12.1,
    longitude: -77.03,
    delegatePreference: "passenger" as "delegate" | "passenger",
  };

  /** A fresh session where the first `count` users are matched into one party. */
  async function matchedSession(count = 3) {
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
        displayName: `Chat fixture ${i}`,
        delegatePreference: i === 0 ? "delegate" : "passenger",
      });
    await matching.match(session.id, userIds[0]);
    return session;
  }

  beforeAll(async () => {
    await db.insert(schema.places).values({
      id: placeId,
      slug: `chat-${placeId}`,
      name: "Chat fixture",
      latitude: -12,
      longitude: -77,
      status: "active",
      isFictional: true,
    });
    await db
      .insert(schema.users)
      .values(
        userIds.map((id, i) => ({ id, displayName: `Chat fixture ${i}` })),
      );
  });
  afterAll(async () => {
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.placeId, placeId));
    await db.delete(schema.places).where(eq(schema.places.id, placeId));
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    await sql.end();
  });

  it("shares messages among members in order and polls by cursor", async () => {
    const s = await matchedSession();
    const [a, b, c] = userIds;
    const first = await chat.post(s.id, a, "Ya llegué.");
    expect(first.displayName).toBe("Chat fixture 0");
    await chat.post(s.id, b, "Voy en camino.");

    const all = await chat.list(s.id, c, 0);
    expect(all.canPost).toBe(true);
    expect(all.messages.map((m) => m.body)).toEqual([
      "Ya llegué.",
      "Voy en camino.",
    ]);
    expect(all.messages[1].displayName).toBe("Chat fixture 1");

    const later = await chat.list(s.id, a, all.messages[1].seq);
    expect(later.messages).toEqual([]);
  });

  it("keeps concurrent posts in commit order", async () => {
    const s = await matchedSession();
    await Promise.all(
      userIds.slice(0, 3).map((u, i) => chat.post(s.id, u, `m${i}`)),
    );
    const { messages } = await chat.list(s.id, userIds[0], 0);
    expect(messages).toHaveLength(3);
    const seqs = messages.map((m) => m.seq);
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
  });

  it("rejects people outside the party", async () => {
    const s = await matchedSession(2);
    await participation.join(s.id, userIds[3], input);
    await expect(chat.post(s.id, userIds[3], "Hola")).rejects.toMatchObject({
      code: "party_not_found",
    });
    await expect(chat.list(s.id, userIds[3], 0)).rejects.toMatchObject({
      code: "party_not_found",
    });
  });

  it("keeps two groups in the same room apart", async () => {
    const s = await matchedSession(2);
    // A second pair matched later in the same room forms its own group.
    for (const i of [2, 3])
      await participation.join(s.id, userIds[i], {
        ...input,
        displayName: `Chat fixture ${i}`,
        delegatePreference: i === 2 ? "delegate" : "passenger",
      });
    await matching.match(s.id, userIds[2]);
    await chat.post(s.id, userIds[0], "Mensaje del grupo A");
    await chat.post(s.id, userIds[2], "Mensaje del grupo B");
    const bodies = async (user: string) =>
      (await chat.list(s.id, user, 0)).messages.map((m) => m.body);
    expect(await bodies(userIds[1])).toEqual(["Mensaje del grupo A"]);
    expect(await bodies(userIds[3])).toEqual(["Mensaje del grupo B"]);
  });

  it("ends access when the party dissolves and goes read-only after the ride", async () => {
    const s = await matchedSession();
    const [a, b, c] = userIds;
    await chat.post(s.id, a, "Hola");
    await parties.apply(s.id, c, "leave");
    await expect(chat.list(s.id, a, 0)).rejects.toMatchObject({
      code: "party_not_found",
    });

    const done = await matchedSession(2);
    await chat.post(done.id, a, "Gracias");
    for (const u of [a, b]) await parties.apply(done.id, u, "confirm");
    await parties.apply(done.id, a, "start");
    await parties.apply(done.id, a, "complete");
    const after = await chat.list(done.id, b, 0);
    expect(after.canPost).toBe(false);
    expect(after.messages.map((m) => m.body)).toEqual(["Gracias"]);
    await expect(chat.post(done.id, b, "Hola")).rejects.toMatchObject({
      code: "chat_closed",
    });
  });
});
