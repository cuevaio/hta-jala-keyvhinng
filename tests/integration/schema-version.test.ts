import { afterAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { expectedMigration, schemaStatus } from "@/db/schema-version";

// Opt in explicitly. Read-only: never touches the migration table.
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("schema version", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 1 });
  const db = drizzle(sql, { schema });
  afterAll(() => sql.end());

  it("is current once every migration in the journal is applied", async () => {
    expect(await schemaStatus(db)).toEqual({
      expected: expectedMigration.tag,
      current: true,
    });
  });

  it("is behind when the build expects a migration the database lacks", async () => {
    const next = { tag: "9999_next", when: expectedMigration.when + 1 };
    expect(await schemaStatus(db, next)).toEqual({
      expected: "9999_next",
      current: false,
    });
  });
});
