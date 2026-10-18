import { selfieDataUrl } from "../fixtures/selfie";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { createParticipationRepository } from "@/modules/sessions/infrastructure/participation.repository";
import { createSessionRepository } from "@/modules/sessions/infrastructure/session.repository";

// Opt in explicitly. Only fixtures created by this suite are removed.
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("public room data", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 2 });
  const db = drizzle(sql, { schema });
  const participation = createParticipationRepository(db);
  const rooms = createSessionRepository(db);
  const userId = randomUUID();
  const sessionIds: string[] = [];
  // Own corner of the map, away from other suites' fixtures.
  const start = { latitude: -10.5, longitude: -75.5 };
  const home = { latitude: -10.61234, longitude: -75.52876 };
  const exactLabel = "Jirón Las Camelias 742, Dpto 3B, Barranco";

  beforeAll(async () => {
    await db.insert(schema.users).values({ id: userId, displayName: "Ana" });
  });
  afterAll(async () => {
    await db
      .delete(schema.sessions)
      .where(inArray(schema.sessions.id, sessionIds));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    await sql.end();
  });

  it("lists, searches and shows a room without the creator's address", async () => {
    const room = await participation.createGroup(userId, {
      selfieDataUrl,
      displayName: "Ana",
      originLabel: "Mi punto de salida",
      originLatitude: start.latitude,
      originLongitude: start.longitude,
      destinationLabel: exactLabel,
      latitude: home.latitude,
      longitude: home.longitude,
      destinationArea: "Barranco",
      delegatePreference: "passenger",
      departInMinutes: 0,
    });
    sessionIds.push(room.id);

    const found = await participation.search({
      olat: start.latitude,
      olng: start.longitude,
      dlat: home.latitude,
      dlng: home.longitude,
      depart: 0,
    });
    const views = [
      found.find((g) => g.id === room.id),
      (await rooms.list({ limit: 100 })).find((r) => r.id === room.id),
      await rooms.findById(room.id),
    ];
    for (const view of views) {
      expect(view).toBeDefined();
      const published = JSON.stringify(view);
      expect(published).not.toContain("Camelias");
      expect(published).not.toContain(String(home.latitude));
      expect(published).not.toContain(String(home.longitude));
      expect(view?.destinationLabel).toBe("Barranco");
    }
    expect(found.find((g) => g.id === room.id)?.name).toMatch(/^Sala /);

    // The exact destination is still there for matching, on the private row.
    const [mine] = await db
      .select()
      .from(schema.sessionParticipants)
      .where(eq(schema.sessionParticipants.sessionId, room.id));
    expect(mine.destinationLabel).toBe(exactLabel);
    expect(mine.latitude).toBe(home.latitude);
  });
});
