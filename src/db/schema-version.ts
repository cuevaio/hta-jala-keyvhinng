import { sql } from "drizzle-orm";
import journal from "@/db/migrations/meta/_journal.json";
import type { Database } from "@/db";

/** The newest migration this build's code was written against. */
export const expectedMigration = journal.entries.at(-1)!;

export type SchemaStatus = {
  expected: string;
  current: boolean;
};

/**
 * Whether the database has every migration this build expects. Drizzle records
 * each applied migration with its journal timestamp, so the newest applied
 * timestamp must reach the newest one in the journal. Code running against an
 * older schema fails on the first query that touches a new column.
 */
export async function schemaStatus(
  db: Pick<Database, "execute">,
  expected: { tag: string; when: number } = expectedMigration,
): Promise<SchemaStatus> {
  const rows = await db.execute<{ applied: string | null }>(
    sql`select max(created_at)::text as applied from drizzle.__drizzle_migrations`,
  );
  const applied = Number(rows[0]?.applied ?? 0);
  return {
    expected: expected.tag,
    current: applied >= expected.when,
  };
}
