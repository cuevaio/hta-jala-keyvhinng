import { NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_COOKIE,
  googleOauthCookieOptions,
} from "@/modules/auth/infrastructure/oauth-transaction";

export function signInRedirect(appUrl: string, error: string, next: string) {
  const url = new URL("/sign-in", appUrl);
  url.searchParams.set("error", error);
  if (next !== "/") url.searchParams.set("next", next);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(GOOGLE_OAUTH_COOKIE, "", {
    ...googleOauthCookieOptions(),
    maxAge: 0,
  });
  return response;
}
