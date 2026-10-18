import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { browserSessions, users } from "@/db/schema";
import { ApiError } from "@/lib/http";

const COOKIE = "jala_participant";
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function readIdentity() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [identity] = await getDb()
    .select({ userId: browserSessions.userId })
    .from(browserSessions)
    .where(
      and(
        eq(browserSessions.tokenHash, hash(token)),
        gt(browserSessions.expiresAt, new Date()),
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
      "Tu sesión del navegador venció. Recarga para continuar.",
    );
  return identity;
}

export async function ensureIdentity() {
  const existing = await readIdentity();
  if (existing) return existing;
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const identity = await getDb().transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ displayName: "Participante" })
      .returning({ userId: users.id });
    await tx
      .insert(browserSessions)
      .values({ userId: user.userId, tokenHash: hash(token), expiresAt });
    return user;
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return identity;
}
