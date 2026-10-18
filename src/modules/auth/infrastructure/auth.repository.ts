import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { users } from "@/db/schema";

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
