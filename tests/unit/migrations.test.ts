import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import journal from "@/db/migrations/meta/_journal.json";

// Migrations run before the new code takes traffic, so the code already serving
// must keep working against the migrated schema. Later migrations may only add.
// Removing or reshaping something takes two releases: stop using it, then drop
// it in a migration marked `-- contract:` with the reason.
const LAST_UNCHECKED_MIGRATION = 12;

const BREAKING = [
  /\bdrop\s+(table|column|type|schema)\b/i,
  /\brename\b/i,
  /\balter\s+column\s+"?\w+"?\s+(set\s+not\s+null|(set\s+data\s+)?type)\b/i,
  /\badd\s+column\b(?![^;]*\bdefault\b)[^;]*\bnot\s+null\b/i,
];

const checked = journal.entries.filter(
  (entry) => entry.idx > LAST_UNCHECKED_MIGRATION,
);

function breakingStatements(source: string) {
  return source
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => BREAKING.some((rule) => rule.test(statement)));
}

describe("migrations", () => {
  it("flags statements that break the code still serving", () => {
    expect(
      breakingStatements(
        [
          'ALTER TABLE "users" DROP COLUMN "name";',
          'ALTER TABLE "users" RENAME COLUMN "a" TO "b";',
          'ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;',
          'ALTER TABLE "users" ADD COLUMN "kind" text NOT NULL;',
        ].join("--> statement-breakpoint\n"),
      ),
    ).toHaveLength(4);
    expect(
      breakingStatements(
        [
          'ALTER TABLE "users" ADD COLUMN "kind" text DEFAULT \'a\' NOT NULL;',
          'ALTER TABLE "users" ADD COLUMN "note" text;',
          'CREATE TABLE "things" ("id" uuid PRIMARY KEY NOT NULL);',
        ].join("--> statement-breakpoint\n"),
      ),
    ).toEqual([]);
  });

  it.each(checked.map((entry) => [entry.tag]))(
    "%s only adds to the schema",
    (tag) => {
      const source = readFileSync(`src/db/migrations/${tag}.sql`, "utf8");
      if (/^--\s*contract:\s*\S/m.test(source)) return;
      expect(breakingStatements(source)).toEqual([]);
    },
  );
});
