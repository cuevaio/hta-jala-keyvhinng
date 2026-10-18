import { beforeEach, describe, expect, it } from "vitest";
import {
  decoyHash,
  hashPassword,
  verifyPassword,
} from "@/modules/auth/domain/password";
import {
  safeNextPath,
  signInInput,
  signUpInput,
} from "@/modules/auth/schemas/auth.schema";
import { createAuthService } from "@/modules/auth/application/auth.service";
import type {
  AccountRecord,
  AuthRepository,
} from "@/modules/auth/infrastructure/auth.repository";
import { EmailTakenError, InvalidCredentialsError } from "@/lib/errors";
import { consume, resetRateLimits } from "@/lib/rate-limit";

describe("password hashing", () => {
  it("verifies the right password, rejects the wrong one, and salts each hash", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong horse", hash)).toBe(false);
    expect(await hashPassword("correct horse")).not.toBe(hash);
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$a$b")).toBe(false);
  });

  it("treats Unicode-equivalent passwords as equal", async () => {
    const hash = await hashPassword("ca\u0301fe-secreto");
    expect(await verifyPassword("c\u00e1fe-secreto", hash)).toBe(true);
  });
});

describe("auth schemas", () => {
  it("normalizes email and trims the name", () => {
    expect(
      signUpInput.parse({
        displayName: "  Ana ",
        email: "  Ana@Correo.COM ",
        password: "12345678",
      }),
    ).toEqual({
      displayName: "Ana",
      email: "ana@correo.com",
      password: "12345678",
    });
  });

  it("rejects short passwords, bad emails and empty names", () => {
    const base = { displayName: "Ana", email: "a@b.co", password: "12345678" };
    expect(
      signUpInput.safeParse({ ...base, password: "1234567" }).success,
    ).toBe(false);
    expect(signUpInput.safeParse({ ...base, email: "nope" }).success).toBe(
      false,
    );
    expect(signUpInput.safeParse({ ...base, displayName: " " }).success).toBe(
      false,
    );
    expect(
      signInInput.safeParse({ email: "a@b.co", password: "" }).success,
    ).toBe(false);
  });

  it("only allows same-site relative redirect targets", () => {
    expect(safeNextPath("/sessions/abc")).toBe("/sessions/abc");
    for (const bad of [
      "//evil.com",
      "https://evil.com",
      "/\\evil.com",
      "javascript:1",
      "",
      null,
      undefined,
      "/a\nb",
    ]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});

describe("auth service", () => {
  let accounts: Map<string, AccountRecord>;
  let repository: AuthRepository;
  const mailer = { send: async () => {} };

  beforeEach(() => {
    accounts = new Map();
    repository = {
      findByEmail: async (email) => accounts.get(email) ?? null,
      create: async (input) => {
        if (accounts.has(input.email)) {
          throw Object.assign(new Error("duplicate"), { code: "23505" });
        }
        const id = `user-${accounts.size + 1}`;
        accounts.set(input.email, { id, googleSub: null, ...input });
        return { id };
      },
      // Reset and change-password persistence is covered by the integration tests.
    } as AuthRepository;
  });

  it("signs up, stores only a hash, then signs in", async () => {
    const service = createAuthService(repository, mailer, "http://app.test");
    const created = await service.signUp({
      displayName: "Ana",
      email: "ana@x.co",
      password: "supersecret",
    });
    expect(accounts.get("ana@x.co")!.passwordHash).not.toContain("supersecret");
    expect(
      await service.signIn({ email: "ana@x.co", password: "supersecret" }),
    ).toEqual(created);
  });

  it("maps a unique violation (including wrapped causes) to EmailTakenError", async () => {
    const service = createAuthService(repository, mailer, "http://app.test");
    const input = {
      displayName: "Ana",
      email: "ana@x.co",
      password: "supersecret",
    };
    await service.signUp(input);
    await expect(service.signUp(input)).rejects.toBeInstanceOf(EmailTakenError);
    repository.create = async () => {
      throw new Error("query failed", { cause: { code: "23505" } });
    };
    await expect(
      service.signUp({ ...input, email: "b@x.co" }),
    ).rejects.toBeInstanceOf(EmailTakenError);
  });

  it("gives the same error for unknown email and wrong password", async () => {
    const service = createAuthService(repository, mailer, "http://app.test");
    await service.signUp({
      displayName: "Ana",
      email: "ana@x.co",
      password: "supersecret",
    });
    await expect(
      service.signIn({ email: "ana@x.co", password: "wrongpass" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      service.signIn({ email: "ghost@x.co", password: "supersecret" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(await decoyHash()).toMatch(/^scrypt\$/);
  });
});

describe("rate limiter", () => {
  beforeEach(resetRateLimits);

  it("allows up to the limit per key, then blocks, independently per key", async () => {
    for (let i = 0; i < 3; i++) expect(await consume("a", 3, 1000)).toBe(true);
    expect(await consume("a", 3, 1000)).toBe(false);
    expect(await consume("b", 3, 1000)).toBe(true);
  });
});
