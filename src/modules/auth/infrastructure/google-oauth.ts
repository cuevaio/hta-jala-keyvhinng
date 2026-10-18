import { GoogleSignInError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  InvalidGoogleTokenError,
  readGoogleIdToken,
  type GoogleIdClaims,
  type RsaJwk,
} from "@/modules/auth/domain/google-token";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const CERTS_TTL_MS = 60 * 60 * 1000;

let cachedCerts: { keys: RsaJwk[]; expiresAt: number } | undefined;

export function clearGoogleCertCache() {
  cachedCerts = undefined;
}

async function loadCerts(
  fetchImpl: typeof fetch,
  force: boolean,
): Promise<RsaJwk[]> {
  if (!force && cachedCerts && cachedCerts.expiresAt > Date.now()) {
    return cachedCerts.keys;
  }
  const response = await fetchImpl(CERTS_URL, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new GoogleSignInError("failed");
  const body = (await response.json()) as { keys?: RsaJwk[] };
  if (!Array.isArray(body.keys)) throw new GoogleSignInError("failed");
  cachedCerts = { keys: body.keys, expiresAt: Date.now() + CERTS_TTL_MS };
  return body.keys;
}

/**
 * Exchanges an authorization code for a verified Google identity.
 * The ID token is accepted only after its signature matches Google's published keys.
 */
export async function exchangeGoogleCode(
  input: {
    code: string;
    codeVerifier: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    now?: Date;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleIdClaims> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json().catch(() => null)) as {
    id_token?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok || !payload || typeof payload.id_token !== "string") {
    logger.warn("Google token exchange failed", {
      status: response.status,
      error: typeof payload?.error === "string" ? payload.error : "unknown",
    });
    throw new GoogleSignInError("failed");
  }

  let keys = await loadCerts(fetchImpl, false);
  try {
    return readGoogleIdToken(payload.id_token, { keys }, input);
  } catch (error) {
    if (!(error instanceof InvalidGoogleTokenError)) throw error;
    keys = await loadCerts(fetchImpl, true);
    try {
      return readGoogleIdToken(payload.id_token, { keys }, input);
    } catch (again) {
      if (again instanceof InvalidGoogleTokenError) {
        throw new GoogleSignInError("failed");
      }
      throw again;
    }
  }
}
