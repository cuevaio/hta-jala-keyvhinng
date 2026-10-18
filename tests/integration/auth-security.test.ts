import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { createAuthService } from "@/modules/auth/application/auth.service";
import { createAuthRepository } from "@/modules/auth/infrastructure/auth.repository";
import { createPostgresRateLimiter } from "@/lib/rate-limit";
import type { Email } from "@/lib/mailer";
import { InvalidCredentialsError, InvalidResetTokenError } from "@/lib/errors";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("auth security", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 8 });
  const db = drizzle(sql, { schema });
  const sent: Email[] = [];
  const auth = createAuthService(
    createAuthRepository(db),
    { send: async (email) => void sent.push(email) },
    "http://app.test",
  );
  const email = `reset-${randomUUID()}@test.co`;
  let userId = "";
  const tokenFromMail = () =>
    /token=([a-f0-9]{64})/.exec(sent.at(-1)!.text)![1];
  const signedInSessions = async () =>
    (
      await db
        .select()
        .from(schema.browserSessions)
        .where(eq(schema.browserSessions.userId, userId))
    ).length;
  const addSession = () =>
    db.insert(schema.browserSessions).values({
      userId,
      tokenHash: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    });

  beforeAll(async () => {
    ({ userId } = await auth.signUp({
      displayName: "Reset fixture",
      email,
      password: "original-password",
    }));
  });
  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    await sql.end();
  });

  it("counts atomically across concurrent hits and restarts expired windows", async () => {
    const limiter = createPostgresRateLimiter(db);
    const key = `test:${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 10 }, () => limiter.hit(key, 4, 60_000)),
    );
    expect(results.filter(Boolean)).toHaveLength(4);
    await db
      .update(schema.rateLimits)
      .set({ resetAt: new Date(Date.now() - 1000) })
      .where(eq(schema.rateLimits.key, key));
    expect(await limiter.hit(key, 4, 60_000)).toBe(true);
    await db.delete(schema.rateLimits).where(eq(schema.rateLimits.key, key));
  });

  it("names the account behind a usable reset link only", async () => {
    await auth.requestPasswordReset(email);
    const token = tokenFromMail();
    expect(await auth.resetAccountEmail(token)).toBe(email);
    expect(await auth.resetAccountEmail("0".repeat(64))).toBeNull();
    expect(await auth.resetAccountEmail("")).toBeNull();
    await db
      .update(schema.passwordResetTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.passwordResetTokens.userId, userId));
    expect(await auth.resetAccountEmail(token)).toBeNull();
    sent.length = 0;
  });

  it("emails a reset link only for real accounts, storing just the token hash", async () => {
    await auth.requestPasswordReset(`ghost-${randomUUID()}@test.co`);
    expect(sent).toHaveLength(0);
    await auth.requestPasswordReset(email);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(email);
    const token = tokenFromMail();
    const rows = await db.select().from(schema.passwordResetTokens);
    expect(rows.some((r) => r.tokenHash === token)).toBe(false);
  });

  it("resets once, signs out every session and rejects reuse", async () => {
    await auth.requestPasswordReset(email);
    const token = tokenFromMail();
    await addSession();
    await addSession();
    await auth.resetPassword(token, "brand-new-password");
    expect(await signedInSessions()).toBe(0);
    await expect(
      auth.resetPassword(token, "another-password"),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
    await expect(
      auth.signIn({ email, password: "original-password" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(
      (await auth.signIn({ email, password: "brand-new-password" })).userId,
    ).toBe(userId);
  });

  it("only the newest link works, and expired links are rejected", async () => {
    await auth.requestPasswordReset(email);
    const first = tokenFromMail();
    await auth.requestPasswordReset(email);
    const second = tokenFromMail();
    await expect(
      auth.resetPassword(first, "irrelevant-password"),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
    await db
      .update(schema.passwordResetTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.passwordResetTokens.userId, userId));
    await expect(
      auth.resetPassword(second, "irrelevant-password"),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it("changing the password needs the current one and revokes sessions", async () => {
    await addSession();
    await expect(
      auth.changePassword(userId, "wrong-password", "changed-password"),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(await signedInSessions()).toBe(1);
    await auth.changePassword(userId, "brand-new-password", "changed-password");
    expect(await signedInSessions()).toBe(0);
    await auth.signIn({ email, password: "changed-password" });
  });
});
