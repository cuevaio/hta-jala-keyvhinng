import { getEnv } from "@/lib/env";

type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  let min: Level = "info";
  try {
    min = getEnv().LOG_LEVEL;
  } catch {
    // env invalid: fall back to info so the original error can still be logged
  }
  if (order[level] < order[min]) return;
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...meta,
  });
  (level === "error" ? console.error : console.log)(line);
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => log("debug", m, meta),
  info: (m: string, meta?: Record<string, unknown>) => log("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log("error", m, meta),
};
