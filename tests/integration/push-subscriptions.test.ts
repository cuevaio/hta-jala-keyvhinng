import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { inArray } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { createPushSubscriptionRepository } from "@/modules/notifications/infrastructure/push-subscription.repository";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("push subscriptions", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 4 });
  const db = drizzle(sql, { schema });
  const repo = createPushSubscriptionRepository(db);
  const [alice, bob] = [randomUUID(), randomUUID()];
  const device = (name: string) => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/${name}-${alice}`,
    p256dh: `p256dh-${name}`,
    auth: `auth-${name}`,
  });

  beforeAll(async () => {
    await db.insert(schema.users).values([
      { id: alice, displayName: "Push fixture" },
      { id: bob, displayName: "Push fixture" },
    ]);
  });
  afterAll(async () => {
    await db.delete(schema.users).where(inArray(schema.users.id, [alice, bob]));
    await sql.end();
  });

  it("keeps one row per browser and hands a shared browser to the latest account", async () => {
    await repo.save(alice, device("phone"));
    await repo.save(alice, { ...device("phone"), auth: "rotated" });
    await repo.save(alice, device("laptop"));
    expect(await repo.forUsers([alice])).toHaveLength(2);
    expect(
      (await repo.forUsers([alice])).find((s) => s.auth === "rotated"),
    ).toBeTruthy();

    await repo.save(bob, device("laptop"));
    expect((await repo.forUsers([alice])).map((s) => s.endpoint)).toEqual([
      device("phone").endpoint,
    ]);
    expect(await repo.forUsers([bob])).toHaveLength(1);
  });

  it("only removes a browser for its own account, and drops gone endpoints", async () => {
    await repo.remove(bob, device("phone").endpoint);
    expect(await repo.forUsers([alice])).toHaveLength(1);
    await repo.remove(alice, device("phone").endpoint);
    expect(await repo.forUsers([alice])).toHaveLength(0);

    await repo.removeEndpoints([device("laptop").endpoint]);
    expect(await repo.forUsers([bob])).toHaveLength(0);
  });
});
