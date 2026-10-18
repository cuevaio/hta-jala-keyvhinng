import { getDb } from "@/db";
import { schemaStatus } from "@/db/schema-version";
import { logger } from "@/lib/logger";
import { ok } from "@/lib/http";

function unavailable(code: string, message: string) {
  return Response.json({ error: { code, message } }, { status: 503 });
}

/** Ready only when the database is reachable and has this build's migrations. */
export async function GET() {
  let schema;
  try {
    schema = await schemaStatus(getDb());
  } catch (error) {
    logger.error("health.database_unavailable", { error: String(error) });
    return unavailable("database_unavailable", "Database is not reachable");
  }
  if (!schema.current) {
    logger.error("health.schema_behind", { expected: schema.expected });
    return unavailable(
      "schema_behind",
      `Database is missing migration ${schema.expected}`,
    );
  }
  return ok({
    status: "ok",
    database: "up",
    schema: schema.expected,
    time: new Date().toISOString(),
  });
}
