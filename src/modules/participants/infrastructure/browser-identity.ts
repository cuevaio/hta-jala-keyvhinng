import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { browserSessions, users } from "@/db/schema";
import { ApiError } from "@/lib/http";

const COOKIE = "jala_participant";
const SESSION_DAYS = 7;
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

async function readToken() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

/** The signed-in account, or null. Legacy anonymous guests (no email) never match. */
export async function readIdentity() {
  const token = await readToken();
  if (!token) return null;
  const [identity] = await getDb()
    .select({ userId: browserSessions.userId, displayName: users.displayName })
    .from(browserSessions)
    .innerJoin(users, eq(users.id, browserSessions.userId))
    .where(
      and(
        eq(browserSessions.tokenHash, hash(token)),
        gt(browserSessions.expiresAt, new Date()),
        isNotNull(users.email),
      ),
    );
  return identity ?? null;
}

export async function requireIdentity() {
  const identity = await readIdentity();
  if (!identity)
    throw new ApiError(
      401,
      "identity_required",
      "Inicia sesión para continuar.",
    );
  return identity;
}

/** Issues a fresh session cookie for `userId`, revoking any session this browser held. */
export async function startSession(userId: string) {
  await endSession();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getDb()
    .insert(browserSessions)
    .values({ userId, tokenHash: hash(token), expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Deletes this browser's session server-side and clears the cookie. */
export async function endSession() {
  const token = await readToken();
  if (!token) return;
  await getDb()
    .delete(browserSessions)
    .where(eq(browserSessions.tokenHash, hash(token)));
  (await cookies()).delete(COOKIE);
}
