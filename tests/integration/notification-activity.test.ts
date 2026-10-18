import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import {
  createActivityRepository,
  recordActivity,
} from "@/modules/notifications/infrastructure/activity.repository";
import { groupAnchors } from "./group-fixture";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("saved notification activity", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 4 });
  const db = drizzle(sql, { schema });
  const repo = createActivityRepository(db);
  const [alice, bob, roomId] = [randomUUID(), randomUUID(), randomUUID()];

  beforeAll(async () => {
    await db.insert(schema.users).values([
      { id: alice, displayName: "Activity fixture" },
      { id: bob, displayName: "Activity fixture" },
    ]);
    await db.insert(schema.sessions).values({
      id: roomId,
      ...groupAnchors,
      departsAt: new Date(),
      opensAt: new Date(),
      closesAt: new Date(Date.now() + 60_000),
    });
  });
  afterAll(async () => {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, roomId));
    await db.delete(schema.users).where(inArray(schema.users.id, [alice, bob]));
    await sql.end();
  });

  it("saves one update per recipient, survives a new repository, and scopes reads to the account", async () => {
    expect(await repo.list(alice)).toEqual({ items: [], unreadCount: 0 });
    await db.transaction((tx) =>
      recordActivity(tx, [alice, bob, alice], roomId, "formed"),
    );
    const a = await createActivityRepository(db).list(alice);
    const b = await repo.list(bob);
    expect(a.unreadCount).toBe(1);
    expect(a.items).toHaveLength(1);
    expect(a.items[0]).toMatchObject({
      sessionId: roomId,
      kind: "formed",
      readAt: null,
    });
    expect(a.items[0].id).not.toBe(b.items[0].id);
    expect(a.items[0]).not.toHaveProperty("userId");

    // Knowing another person's notification ID grants no ability to read/clear it.
    await repo.markRead(alice, [b.items[0].id]);
    expect((await repo.list(bob)).unreadCount).toBe(1);
    await repo.markRead(alice, [a.items[0].id]);
    const readAt = (await repo.list(alice)).items[0].readAt;
    expect(readAt).not.toBeNull();
    await repo.markRead(alice, [a.items[0].id]);
    expect((await repo.list(alice)).items[0].readAt).toBe(readAt);
    expect((await repo.list(alice)).unreadCount).toBe(0);
  });

  it("does not publish activity for a rolled-back ride write", async () => {
    const before = await repo.list(alice);
    await expect(
      db.transaction(async (tx) => {
        await recordActivity(tx, [alice], roomId, "started");
        throw new Error("ride write rolled back");
      }),
    ).rejects.toThrow("ride write rolled back");
    expect(await repo.list(alice)).toEqual(before);
  });

  it("limits the visible feed, orders it newest first, and clears all unread for only the caller", async () => {
    const start = Date.now();
    await db.insert(schema.notificationActivity).values(
      Array.from({ length: 35 }, (_, i) => ({
        userId: alice,
        sessionId: roomId,
        kind: "completed" as const,
        createdAt: new Date(start + i * 1000),
      })),
    );
    const feed = await repo.list(alice);
    expect(feed.items).toHaveLength(30);
    expect(feed.unreadCount).toBe(35);
    expect(feed.items[0].createdAt).toBe(
      new Date(start + 34_000).toISOString(),
    );
    await repo.markRead(alice);
    expect((await repo.list(alice)).unreadCount).toBe(0);
    expect((await repo.list(bob)).unreadCount).toBe(1);
  });
});
