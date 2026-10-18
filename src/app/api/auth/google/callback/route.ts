import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleRedirectUri, getEnv, readGoogleAuth } from "@/lib/env";
import { GoogleSignInError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { consume } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";
import { exchangeGoogleCode } from "@/modules/auth/infrastructure/google-oauth";
import {
  GOOGLE_OAUTH_COOKIE,
  oauthStatesMatch,
  readOauthTransaction,
} from "@/modules/auth/infrastructure/oauth-transaction";
import { startSession } from "@/modules/participants/infrastructure/browser-identity";
import { clientKey } from "../../client-key";
import { signInRedirect } from "../redirect";

const WINDOW_MS = 15 * 60 * 1000;

function failureCode(error: unknown): string {
  if (error instanceof GoogleSignInError) {
    if (error.reason === "unverified") return "google_unverified";
    if (error.reason === "conflict") return "google_conflict";
  }
  return "google_failed";
}

/** Completes Sign in with Google and starts the same browser session as a password login. */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const stored = readOauthTransaction(
    (await cookies()).get(GOOGLE_OAUTH_COOKIE)?.value,
  );
  const next = stored?.next ?? "/";
  let appUrl = requestUrl.origin;
  try {
    appUrl = getEnv().NEXT_PUBLIC_APP_URL;
  } catch {
    return signInRedirect(appUrl, "google_unconfigured", next);
  }

  const google = readGoogleAuth();
  if (!google) return signInRedirect(appUrl, "google_unconfigured", next);
  if (requestUrl.searchParams.get("error") === "access_denied") {
    return signInRedirect(appUrl, "google_denied", next);
  }

  const code = requestUrl.searchParams.get("code") ?? "";
  const state = requestUrl.searchParams.get("state") ?? "";
  if (
    !stored ||
    code.length < 1 ||
    code.length > 2048 ||
    !oauthStatesMatch(stored.state, state)
  ) {
    return signInRedirect(appUrl, "google_failed", next);
  }
  if (
    !(await consume(`google-callback:${clientKey(request)}`, 30, WINDOW_MS))
  ) {
    return signInRedirect(appUrl, "google_rate_limited", next);
  }

  try {
    const profile = await exchangeGoogleCode({
      code,
      codeVerifier: stored.verifier,
      clientId: google.clientId,
      clientSecret: google.clientSecret,
      redirectUri: googleRedirectUri(appUrl),
    });
    const user = await getServices().auth.signInWithGoogle(profile);
    await startSession(user.userId);
    const destination = new URL(next, appUrl);
    const response = NextResponse.redirect(destination);
    response.headers.set("Cache-Control", "private, no-store");
    response.cookies.set(GOOGLE_OAUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    if (!(error instanceof GoogleSignInError)) {
      logger.error("Google sign-in failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    return signInRedirect(appUrl, failureCode(error), next);
  }
}
