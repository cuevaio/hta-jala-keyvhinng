import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { browserSessions, passwordResetTokens, users } from "@/db/schema";
import { GoogleSignInError } from "@/lib/errors";
import {
  decideGoogleLink,
  type LinkedAccount,
} from "@/modules/auth/domain/google-link";

export interface AccountRecord {
  id: string;
  displayName: string;
  email: string;
  passwordHash: string | null;
  googleSub: string | null;
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

const accountColumns = {
  id: users.id,
  displayName: users.displayName,
  email: users.email,
  passwordHash: users.passwordHash,
  googleSub: users.googleSub,
};

function toAccount(
  row:
    | {
        id: string;
        displayName: string;
        email: string | null;
        passwordHash: string | null;
        googleSub: string | null;
      }
    | undefined,
): AccountRecord | null {
  if (!row?.email) return null;
  return {
    id: row.id,
    displayName: row.displayName,
    email: row.email,
    passwordHash: row.passwordHash,
    googleSub: row.googleSub,
  };
}

export function createAuthRepository(db: Database) {
  async function findLinked(
    tx: Pick<Database, "select">,
    column: "email" | "googleSub",
    value: string,
  ): Promise<LinkedAccount | null> {
    const [row] = await tx
      .select(accountColumns)
      .from(users)
      .where(eq(column === "email" ? users.email : users.googleSub, value));
    const account = toAccount(row);
    return account
      ? {
          id: account.id,
          displayName: account.displayName,
          email: account.email,
          googleSub: account.googleSub,
        }
      : null;
  }

  async function writeGoogleAccount(input: {
    displayName: string;
    email: string;
    googleSub: string;
  }): Promise<{ id: string; displayName: string }> {
    return db.transaction(async (tx) => {
      const bySub = await findLinked(tx, "googleSub", input.googleSub);
      const byEmail = await findLinked(tx, "email", input.email);
      const decision = decideGoogleLink(
        { sub: input.googleSub, email: input.email },
        bySub,
        byEmail,
      );
      if (decision.type === "sign-in") {
        return { id: decision.userId, displayName: decision.displayName };
      }
      if (decision.type === "reject") throw new GoogleSignInError("conflict");
      if (decision.type === "link") {
        const [updated] = await tx
          .update(users)
          .set({ googleSub: input.googleSub })
          .where(and(eq(users.id, decision.userId), isNull(users.googleSub)))
          .returning({ id: users.id, displayName: users.displayName });
        if (updated) return updated;
        const current = await findLinked(tx, "email", input.email);
        if (current?.googleSub === input.googleSub) {
          return { id: current.id, displayName: current.displayName };
        }
        throw new GoogleSignInError("conflict");
      }
      const [created] = await tx
        .insert(users)
        .values({
          displayName: input.displayName,
          email: input.email,
          googleSub: input.googleSub,
        })
        .returning({ id: users.id, displayName: users.displayName });
      return created;
    });
  }

  return {
    async findByEmail(email: string): Promise<AccountRecord | null> {
      const [row] = await db
        .select(accountColumns)
        .from(users)
        .where(eq(users.email, email));
      return toAccount(row);
    },
    async findById(id: string): Promise<AccountRecord | null> {
      const [row] = await db
        .select(accountColumns)
        .from(users)
        .where(eq(users.id, id));
      return toAccount(row);
    },
    /**
     * Creates a Google account, links a verified email onto an existing password
     * account, or returns the account already tied to this Google subject.
     * Retries once when a concurrent insert wins the unique email or subject.
     */
    async upsertFromGoogle(input: {
      displayName: string;
      email: string;
      googleSub: string;
    }): Promise<{ id: string; displayName: string }> {
      try {
        return await writeGoogleAccount(input);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        return writeGoogleAccount(input);
      }
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
