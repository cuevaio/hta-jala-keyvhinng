import { and, eq, gt } from "drizzle-orm";
import type { Database } from "@/db";
import { browserSessions, passwordResetTokens, users } from "@/db/schema";

export interface AccountRecord {
  id: string;
  displayName: string;
  email: string;
  passwordHash: string;
}

const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function createAuthRepository(db: Database) {
  return {
    async findByEmail(email: string): Promise<AccountRecord | null> {
      const [row] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.email, email));
      return row && row.email && row.passwordHash
        ? { ...row, email: row.email, passwordHash: row.passwordHash }
        : null;
    },
    async findById(id: string): Promise<AccountRecord | null> {
      const [row] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.id, id));
      return row && row.email && row.passwordHash
        ? { ...row, email: row.email, passwordHash: row.passwordHash }
        : null;
    },
    /** Replaces any earlier outstanding token, so only the newest link works. */
    async saveResetToken(userId: string, tokenHash: string, expiresAt: Date) {
      await db.transaction(async (tx) => {
        await tx
          .delete(passwordResetTokens)
          .where(eq(passwordResetTokens.userId, userId));
        await tx
          .insert(passwordResetTokens)
          .values({ tokenHash, userId, expiresAt });
      });
    },
    /**
     * Atomically spends the token (delete-returning makes it single use), sets the new
     * password and signs the account out everywhere. Null if the token is unknown,
     * expired or already used.
     */
    async resetPassword(tokenHash: string, passwordHash: string) {
      return db.transaction(async (tx) => {
        const [spent] = await tx
          .delete(passwordResetTokens)
          .where(
            and(
              eq(passwordResetTokens.tokenHash, tokenHash),
              gt(passwordResetTokens.expiresAt, new Date()),
            ),
          )
          .returning({ userId: passwordResetTokens.userId });
        if (!spent) return null;
        await tx
          .update(users)
          .set({ passwordHash })
          .where(eq(users.id, spent.userId));
        await tx
          .delete(browserSessions)
          .where(eq(browserSessions.userId, spent.userId));
        return spent.userId;
      });
    },
    /** Sets a new password and revokes every session; the caller then starts a fresh one. */
    async changePassword(userId: string, passwordHash: string) {
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ passwordHash })
          .where(eq(users.id, userId));
        await tx
          .delete(browserSessions)
          .where(eq(browserSessions.userId, userId));
        await tx
          .delete(passwordResetTokens)
          .where(eq(passwordResetTokens.userId, userId));
      });
    },
    /** Throws a unique-violation error when the email is taken (race-safe). */
    async create(input: {
      displayName: string;
      email: string;
      passwordHash: string;
    }): Promise<{ id: string }> {
      const [row] = await db
        .insert(users)
        .values(input)
        .returning({ id: users.id });
      return row;
    },
  };
}
export type AuthRepository = ReturnType<typeof createAuthRepository>;
