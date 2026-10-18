import { getEnv } from "@/lib/env";
import { currentRequest } from "@/lib/request-context";

type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
// Separate streams so the hosting log viewer files them under the right severity.
// Looked up per call, so anything that wraps console later still sees every line.
const stream = {
  debug: "log",
  info: "log",
  warn: "warn",
  error: "error",
} as const satisfies Record<Level, keyof Console>;

/**
 * One JSON line per entry. Lifecycle events use dotted names (`room.join`) and opaque
 * ids only: never emails, addresses, coordinates, photos, chat text or tokens.
 */
function log(level: Level, message: string, meta?: Record<string, unknown>) {
  let min: Level = "info";
  try {
    min = getEnv().LOG_LEVEL;
  } catch {
    // env invalid: fall back to info so the original error can still be logged
  }
  if (order[level] < order[min]) return;
  const request = currentRequest();
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...(request && { requestId: request.requestId }),
    ...meta,
  });
  console[stream[level]](line);
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => log("debug", m, meta),
  info: (m: string, meta?: Record<string, unknown>) => log("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log("error", m, meta),
};

interface PostgresCause {
  code: string;
  table_name?: string;
  column_name?: string;
  constraint_name?: string;
}

function postgresCause(error: unknown): PostgresCause | null {
  for (let e = error, depth = 0; e && depth < 5; depth++) {
    if (
      typeof e === "object" &&
      "code" in e &&
      typeof e.code === "string" &&
      /^[0-9A-Z]{5}$/.test(e.code) &&
      "routine" in e
    )
      return e as PostgresCause;
    e = (e as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * Loggable facts about an error. Database errors give the SQLSTATE and the table,
 * column or constraint involved; their messages are dropped because Drizzle puts the
 * SQL and its parameters (emails, addresses, photos) in them.
 */
export function describeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { errorType: typeof error };
  const pg = postgresCause(error);
  const isQueryError = "query" in error && "params" in error;
  return {
    errorType: error.name,
    ...(pg
      ? {
          sqlState: pg.code,
          table: pg.table_name,
          column: pg.column_name,
          constraint: pg.constraint_name,
        }
      : !isQueryError && { errorMessage: error.message.slice(0, 300) }),
    // Frames only: the message is repeated at the top of the stack and, for query
    // errors, spans several lines that include the parameters.
    stack: error.stack
      ?.split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("at "))
      .slice(0, 5),
  };
}
