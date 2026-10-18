import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { GoogleSignInError, InvalidCredentialsError } from "@/lib/errors";
import { createAuthService } from "@/modules/auth/application/auth.service";
import {
  decideGoogleLink,
  googleDisplayName,
  type LinkedAccount,
} from "@/modules/auth/domain/google-link";
import {
  googleAuthorizationUrl,
  pkceChallenge,
  readGoogleIdToken,
  type RsaJwk,
} from "@/modules/auth/domain/google-token";
import {
  clearGoogleCertCache,
  exchangeGoogleCode,
} from "@/modules/auth/infrastructure/google-oauth";
import type { AuthRepository } from "@/modules/auth/infrastructure/auth.repository";
import {
  createOauthTransaction,
  encodeOauthTransaction,
  oauthStatesMatch,
  readOauthTransaction,
} from "@/modules/auth/infrastructure/oauth-transaction";

const CLIENT_ID = "client-id.apps.googleusercontent.com";

function rsaKey() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: "jwk" }) as unknown as RsaJwk;
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  jwk.use = "sig";
  return { privateKey, jwk };
}

function jwt(
  privateKey: KeyObject,
  payload: Record<string, unknown>,
  kid = "test-key",
) {
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT", kid }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${header}.${body}`;
  const signature = sign("RSA-SHA256", Buffer.from(data), privateKey).toString(
    "base64url",
  );
  return `${data}.${signature}`;
}

function claims(now: number, extra: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "sub-1",
    email: "Ana@X.co",
    email_verified: true,
    name: "Ana",
    iat: now,
    exp: now + 3600,
    ...extra,
  };
}

describe("Google link decision", () => {
  const passwordAccount: LinkedAccount = {
    id: "user-1",
    displayName: "Ana",
    email: "ana@x.co",
    googleSub: null,
  };

  it("creates, links, returns, and refuses the four account cases", () => {
    expect(
      decideGoogleLink({ sub: "sub-1", email: "ana@x.co" }, null, null),
    ).toEqual({
      type: "create",
    });
    expect(
      decideGoogleLink(
        { sub: "sub-1", email: "ana@x.co" },
        null,
        passwordAccount,
      ),
    ).toEqual({ type: "link", userId: "user-1" });
    expect(
      decideGoogleLink(
        { sub: "sub-1", email: "other@x.co" },
        { ...passwordAccount, googleSub: "sub-1" },
        null,
      ),
    ).toEqual({ type: "sign-in", userId: "user-1", displayName: "Ana" });
    expect(
      decideGoogleLink({ sub: "sub-2", email: "ana@x.co" }, null, {
        ...passwordAccount,
        googleSub: "sub-1",
      }),
    ).toEqual({ type: "reject" });
  });

  it("builds a display name from the profile, then the mailbox", () => {
    expect(googleDisplayName("  Ana   Ruiz  ", "ana@x.co")).toBe("Ana Ruiz");
    expect(googleDisplayName("x".repeat(80), "ana@x.co")).toHaveLength(60);
    expect(googleDisplayName("   ", "ana.perez@x.co")).toBe("ana.perez");
    expect(googleDisplayName(undefined, "@@@")).toBe("Pasajero");
  });
});

describe("Google ID token", () => {
  const now = 1_700_000_000;
  const { privateKey, jwk } = rsaKey();

  it("reads a signed token and rejects a bad signature, audience, or expiry", () => {
    const token = jwt(privateKey, claims(now));
    expect(
      readGoogleIdToken(
        token,
        { keys: [jwk] },
        { clientId: CLIENT_ID, now: new Date(now * 1000) },
      ),
    ).toEqual({
      sub: "sub-1",
      email: "Ana@X.co",
      emailVerified: true,
      name: "Ana",
    });
    const [header, body] = token.split(".");
    expect(() =>
      readGoogleIdToken(
        `${header}.${body}.not-a-signature`,
        { keys: [jwk] },
        {
          clientId: CLIENT_ID,
          now: new Date(now * 1000),
        },
      ),
    ).toThrow(/Invalid Google token/);
    expect(() =>
      readGoogleIdToken(
        jwt(privateKey, claims(now, { aud: "other" })),
        { keys: [jwk] },
        {
          clientId: CLIENT_ID,
          now: new Date(now * 1000),
        },
      ),
    ).toThrow(/Invalid Google token/);
    expect(() =>
      readGoogleIdToken(
        jwt(privateKey, claims(now, { exp: now - 120 })),
        { keys: [jwk] },
        {
          clientId: CLIENT_ID,
          now: new Date(now * 1000),
        },
      ),
    ).toThrow(/Invalid Google token/);
    expect(
      readGoogleIdToken(
        jwt(privateKey, claims(now, { email_verified: false })),
        { keys: [jwk] },
        { clientId: CLIENT_ID, now: new Date(now * 1000) },
      ).emailVerified,
    ).toBe(false);
  });

  it("builds an authorization URL with PKCE and without the client secret", () => {
    const challenge = pkceChallenge("verifier-value-verifier-value-verifier");
    const url = new URL(
      googleAuthorizationUrl({
        clientId: CLIENT_ID,
        redirectUri: "http://localhost:3000/api/auth/google/callback",
        state: "state-value",
        codeChallenge: challenge,
      }),
    );
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("code_challenge")).toBe(challenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.search).not.toContain("secret");
    expect(url.search).not.toContain("verifier-value");
  });
});

describe("Google code exchange", () => {
  const now = 1_700_000_000;
  const { privateKey, jwk } = rsaKey();

  beforeEach(clearGoogleCertCache);

  it("sends the verifier and returns the identity from Google's token", async () => {
    const token = jwt(privateKey, claims(now));
    let body = "";
    const fetchImpl: typeof fetch = async (url, init) => {
      const href = String(url);
      if (href.includes("/token")) {
        body = String(init?.body);
        return new Response(JSON.stringify({ id_token: token }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    };
    const profile = await exchangeGoogleCode(
      {
        code: "auth-code",
        codeVerifier: "verifier-value-verifier-value-verifier",
        clientId: CLIENT_ID,
        clientSecret: "super-secret",
        redirectUri: "http://localhost:3000/api/auth/google/callback",
        now: new Date(now * 1000),
      },
      fetchImpl,
    );
    expect(profile.sub).toBe("sub-1");
    expect(body).toContain(
      "code_verifier=verifier-value-verifier-value-verifier",
    );
    expect(body).toContain("client_secret=super-secret");
    expect(body).not.toContain("id_token");
  });

  it("fails closed when Google rejects the code", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
    await expect(
      exchangeGoogleCode(
        {
          code: "bad",
          codeVerifier: "verifier-value-verifier-value-verifier",
          clientId: CLIENT_ID,
          clientSecret: "super-secret",
          redirectUri: "http://localhost:3000/api/auth/google/callback",
        },
        fetchImpl,
      ),
    ).rejects.toBeInstanceOf(GoogleSignInError);
  });
});

describe("oauth transaction cookie", () => {
  it("round-trips state and drops open redirects", () => {
    const created = createOauthTransaction("/ride?from=home");
    expect(readOauthTransaction(created.cookieValue)).toMatchObject({
      state: created.state,
      verifier: created.verifier,
      next: "/ride?from=home",
    });
    expect(oauthStatesMatch(created.state, created.state)).toBe(true);
    expect(oauthStatesMatch(created.state, `${created.state}x`)).toBe(false);
    const tampered = encodeOauthTransaction({
      state: created.state,
      verifier: created.verifier,
      next: "https://evil.test",
    });
    expect(readOauthTransaction(tampered)?.next).toBe("/");
    expect(readOauthTransaction("not-json")).toBeNull();
  });
});

describe("signInWithGoogle", () => {
  it("refuses an unverified email and signs in a new verified account", async () => {
    const created: Array<{
      email: string;
      displayName: string;
      googleSub: string;
    }> = [];
    const repository = {
      upsertFromGoogle: async (input: {
        email: string;
        displayName: string;
        googleSub: string;
      }) => {
        created.push(input);
        return { id: "user-9", displayName: input.displayName };
      },
      findByEmail: async () => null,
    } as unknown as AuthRepository;
    const service = createAuthService(
      repository,
      { send: async () => {} },
      "http://app.test",
    );
    await expect(
      service.signInWithGoogle({
        sub: "sub-1",
        email: "ana@x.co",
        emailVerified: false,
      }),
    ).rejects.toMatchObject({ reason: "unverified" });
    expect(created).toHaveLength(0);
    expect(
      await service.signInWithGoogle({
        sub: "sub-1",
        email: "  Ana@X.co ",
        emailVerified: true,
        name: "Ana",
      }),
    ).toEqual({ userId: "user-9", displayName: "Ana" });
    expect(created[0]).toMatchObject({
      email: "ana@x.co",
      googleSub: "sub-1",
      displayName: "Ana",
    });
  });

  it("does not accept a password for a Google-only account", async () => {
    const repository = {
      findByEmail: async () => ({
        id: "user-1",
        displayName: "Ana",
        email: "ana@x.co",
        passwordHash: null,
        googleSub: "sub-1",
      }),
    } as unknown as AuthRepository;
    const service = createAuthService(
      repository,
      { send: async () => {} },
      "http://app.test",
    );
    await expect(
      service.signIn({ email: "ana@x.co", password: "supersecret" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
