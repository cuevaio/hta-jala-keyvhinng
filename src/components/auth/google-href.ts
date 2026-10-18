import { readGoogleAuth } from "@/lib/env";

/** Same-origin start URL, or null when Google sign-in is not configured. */
export function googleSignInHref(next: string): string | null {
  if (!readGoogleAuth()) return null;
  return next === "/"
    ? "/api/auth/google"
    : `/api/auth/google?next=${encodeURIComponent(next)}`;
}
