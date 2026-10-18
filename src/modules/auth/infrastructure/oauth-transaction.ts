import { randomBytes, timingSafeEqual } from "node:crypto";
import { safeNextPath } from "@/modules/auth/schemas/auth.schema";
import { pkceChallenge } from "@/modules/auth/domain/google-token";

export const GOOGLE_OAUTH_COOKIE = "jala_google_oauth";
const TEN_MINUTES = 10 * 60;

export function googleOauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TEN_MINUTES,
  };
}

export interface OauthTransaction {
  state: string;
  verifier: string;
  codeChallenge: string;
  next: string;
  cookieValue: string;
}

export function createOauthTransaction(next: string): OauthTransaction {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const storedNext = next.length > 512 ? "/" : safeNextPath(next);
  return {
    state,
    verifier,
    codeChallenge: pkceChallenge(verifier),
    next: storedNext,
    cookieValue: encodeOauthTransaction({
      state,
      verifier,
      next: storedNext,
    }),
  };
}

export function encodeOauthTransaction(value: {
  state: string;
  verifier: string;
  next: string;
}): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** The browser-bound login attempt, or null when the cookie is missing or tampered. */
export function readOauthTransaction(
  cookieValue: string | undefined,
): { state: string; verifier: string; next: string } | null {
  if (!cookieValue || cookieValue.length > 2000) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cookieValue, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { state, verifier, next } = parsed as Record<string, unknown>;
  if (
    typeof state !== "string" ||
    typeof verifier !== "string" ||
    typeof next !== "string"
  ) {
    return null;
  }
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(state)) return null;
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) return null;
  return { state, verifier, next: safeNextPath(next) };
}

export function oauthStatesMatch(expected: string, received: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}
