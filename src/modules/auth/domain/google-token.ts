import {
  createHash,
  createPublicKey,
  verify,
  type JsonWebKey,
} from "node:crypto";

export class InvalidGoogleTokenError extends Error {
  constructor() {
    super("Invalid Google token");
    this.name = "InvalidGoogleTokenError";
  }
}

export interface RsaJwk {
  kty: string;
  kid: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

export interface GoogleIdClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const CLOCK_SKEW_SECONDS = 60;

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function googleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

function decodeJson(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    throw new InvalidGoogleTokenError();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Verifies an ID token that this server received from Google's token endpoint.
 * Signature, issuer, audience, and expiry are checked. `email_verified` may be false;
 * the caller decides whether that identity may sign in.
 */
export function readGoogleIdToken(
  token: string,
  jwks: { keys: RsaJwk[] },
  options: { clientId: string; now?: Date },
): GoogleIdClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new InvalidGoogleTokenError();
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader);
  if (
    !isRecord(header) ||
    header.alg !== "RS256" ||
    typeof header.kid !== "string"
  ) {
    throw new InvalidGoogleTokenError();
  }
  const jwk = jwks.keys.find(
    (key) => key.kid === header.kid && key.kty === "RSA",
  );
  if (!jwk || (jwk.use && jwk.use !== "sig"))
    throw new InvalidGoogleTokenError();

  let valid = false;
  try {
    const key = createPublicKey({
      key: jwk as unknown as JsonWebKey,
      format: "jwk",
    });
    valid = verify(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      key,
      Buffer.from(encodedSignature, "base64url"),
    );
  } catch {
    throw new InvalidGoogleTokenError();
  }
  if (!valid) throw new InvalidGoogleTokenError();

  const claims = decodeJson(encodedPayload);
  if (!isRecord(claims)) throw new InvalidGoogleTokenError();
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (typeof claims.exp !== "number" || claims.exp < now - CLOCK_SKEW_SECONDS) {
    throw new InvalidGoogleTokenError();
  }
  if (typeof claims.iat !== "number" || claims.iat > now + CLOCK_SKEW_SECONDS) {
    throw new InvalidGoogleTokenError();
  }
  if (typeof claims.iss !== "string" || !ISSUERS.has(claims.iss)) {
    throw new InvalidGoogleTokenError();
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(options.clientId))
    throw new InvalidGoogleTokenError();
  if (
    typeof claims.sub !== "string" ||
    claims.sub.length < 1 ||
    claims.sub.length > 255
  ) {
    throw new InvalidGoogleTokenError();
  }
  if (typeof claims.email !== "string") throw new InvalidGoogleTokenError();
  const emailVerified =
    claims.email_verified === true || claims.email_verified === "true";
  return {
    sub: claims.sub,
    email: claims.email,
    emailVerified,
    ...(typeof claims.name === "string" ? { name: claims.name } : {}),
  };
}
