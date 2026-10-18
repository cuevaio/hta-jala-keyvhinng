import { NextResponse } from "next/server";
import { googleRedirectUri, getEnv, readGoogleAuth } from "@/lib/env";
import { logger } from "@/lib/logger";
import { consume } from "@/lib/rate-limit";
import { googleAuthorizationUrl } from "@/modules/auth/domain/google-token";
import { safeNextPath } from "@/modules/auth/schemas/auth.schema";
import {
  createOauthTransaction,
  GOOGLE_OAUTH_COOKIE,
  googleOauthCookieOptions,
} from "@/modules/auth/infrastructure/oauth-transaction";
import { clientKey } from "../client-key";
import { signInRedirect } from "./redirect";

const WINDOW_MS = 15 * 60 * 1000;

/** Starts Sign in with Google. The state and PKCE verifier stay in an HttpOnly cookie. */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const google = readGoogleAuth();
  let appUrl = requestUrl.origin;
  try {
    appUrl = getEnv().NEXT_PUBLIC_APP_URL;
  } catch {
    return signInRedirect(appUrl, "google_unconfigured", next);
  }
  if (!google) return signInRedirect(appUrl, "google_unconfigured", next);
  try {
    if (!(await consume(`google-start:${clientKey(request)}`, 30, WINDOW_MS))) {
      return signInRedirect(appUrl, "google_rate_limited", next);
    }
  } catch (error) {
    logger.error("Google sign-in could not start", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return signInRedirect(appUrl, "google_failed", next);
  }

  const transaction = createOauthTransaction(next);
  const response = NextResponse.redirect(
    googleAuthorizationUrl({
      clientId: google.clientId,
      redirectUri: googleRedirectUri(appUrl),
      state: transaction.state,
      codeChallenge: transaction.codeChallenge,
    }),
  );
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(
    GOOGLE_OAUTH_COOKIE,
    transaction.cookieValue,
    googleOauthCookieOptions(),
  );
  return response;
}
