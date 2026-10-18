import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";

const base = process.env.TEST_APP_URL;
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!base || !url)(
  "browser credential and HTTP participation boundary",
  () => {
    const sql = postgres(url ?? "postgres://unused", { max: 1 });
    const db = drizzle(sql, { schema });
    const eventId = randomUUID();
    const userIds: string[] = [];
    let cookieA: string;
    let cookieB: string;
    let sessionId: string;
    async function post(path: string, body: unknown, cookie = "") {
      return fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(body),
      });
    }
    beforeAll(async () => {
      await db.insert(schema.events).values({
        id: eventId,
        slug: `http-test-${eventId}`,
        name: "HTTP fixture",
        venueName: "Test",
        venueLatitude: -12,
        venueLongitude: -77,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000),
        status: "active",
        isFictional: true,
      });
    });
    afterAll(async () => {
      await db.delete(schema.events).where(eq(schema.events.id, eventId));
      if (userIds.length)
        await db.delete(schema.users).where(inArray(schema.users.id, userIds));
      await sql.end();
    });
    it("issues opaque cookies, reuses identity, and stores no plaintext token", async () => {
      const first = await post("/api/participant", {});
      expect(first.status).toBe(200);
      const setCookie = first.headers.get("set-cookie")!;
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=lax/i);
      cookieA = setCookie.split(";")[0];
      const a = (await first.json()).data;
      userIds.push(a.userId);
      const again = await post("/api/participant", {}, cookieA);
      expect((await again.json()).data.userId).toBe(a.userId);
      const second = await post("/api/participant", {});
      cookieB = second.headers.get("set-cookie")!.split(";")[0];
      const b = (await second.json()).data;
      userIds.push(b.userId);
      expect(a.userId).not.toBe(b.userId);
      const [credential] = await db
        .select()
        .from(schema.browserSessions)
        .where(eq(schema.browserSessions.userId, a.userId));
      expect(credential.tokenHash).not.toBe(cookieA.split("=")[1]);
    });
    it("enforces authentication/membership and shares a persisted roster", async () => {
      const opened = await post("/api/sessions", { eventId }, cookieA);
      expect(opened.status).toBe(200);
      sessionId = (await opened.json()).data.id;
      const path = `/api/sessions/${sessionId}/waiting-room`;
      expect((await fetch(`${base}${path}`)).status).toBe(401);
      expect(
        (await fetch(`${base}${path}`, { headers: { cookie: cookieB } }))
          .status,
      ).toBe(403);
      const input = {
        displayName: "API Ana",
        destinationLabel: "Fictional exact destination",
        latitude: -12.1,
        longitude: -77.03,
        delegatePreference: "delegate",
      };
      expect(
        (await post(`/api/sessions/${sessionId}/join`, input, cookieA)).status,
      ).toBe(200);
      expect(
        (
          await post(
            `/api/sessions/${sessionId}/join`,
            {
              ...input,
              displayName: "API Luis",
              delegatePreference: "passenger",
            },
            cookieB,
          )
        ).status,
      ).toBe(200);
      const rooms = await Promise.all(
        [cookieA, cookieB].map(
          async (cookie) =>
            (
              await (
                await fetch(`${base}${path}`, { headers: { cookie } })
              ).json()
            ).data,
        ),
      );
      expect(rooms[0].participants).toEqual(rooms[1].participants);
      expect(rooms[0].participants).toHaveLength(2);
      expect(rooms[0].me.id).not.toBe(rooms[1].me.id);
      expect(rooms[0].participants[0]).not.toHaveProperty("destinationLabel");
      const spoof = `jala_participant=${userIds[0]}`;
      expect(
        (await fetch(`${base}${path}`, { headers: { cookie: spoof } })).status,
      ).toBe(401);
    });
    it("rejects malformed JSON and cross-site mutations without changing membership", async () => {
      const malformed = await fetch(`${base}/api/sessions/${sessionId}/join`, {
        method: "POST",
        headers: { cookie: cookieA, "Content-Type": "application/json" },
        body: "{",
      });
      expect(malformed.status).toBe(400);
      expect((await malformed.json()).error.code).toBe("invalid_json");
      const crossSite = await fetch(`${base}/api/sessions`, {
        method: "POST",
        headers: {
          cookie: cookieA,
          "Content-Type": "application/json",
          origin: "https://unrelated.test",
        },
        body: JSON.stringify({ eventId }),
      });
      expect(crossSite.status).toBe(403);
    });
  },
);
