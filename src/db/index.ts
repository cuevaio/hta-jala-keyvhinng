import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "@/db/schema";

const globalForDb = globalThis as unknown as {
  jalaSql?: ReturnType<typeof postgres>;
};

/** Lazily creates one pooled client (reused across dev hot reloads). */
export function getDb() {
  globalForDb.jalaSql ??= postgres(getEnv().DATABASE_URL, { max: 10 });
  return drizzle(globalForDb.jalaSql, { schema });
}

export type Database = ReturnType<typeof getDb>;
