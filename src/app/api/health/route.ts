import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { logger } from "@/lib/logger";
import { ok } from "@/lib/http";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return ok({ status: "ok", database: "up", time: new Date().toISOString() });
  } catch (error) {
    logger.error("Health check failed", { error: String(error) });
    return Response.json(
      {
        error: {
          code: "database_unavailable",
          message: "Database is not reachable",
        },
      },
      { status: 503 },
    );
  }
}
