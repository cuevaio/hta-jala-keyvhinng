import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Consistent JSON envelope: `{ data }` on success, `{ error: { code, message } }` on failure. */
export type ApiSuccess<T> = { data: T };
export type ApiFailure = {
  error: { code: string; message: string; details?: unknown };
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ data }, { status });
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json<ApiFailure>(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json<ApiFailure>(
      { error: { code: "not_found", message: error.message } },
      { status: 404 },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json<ApiFailure>(
      {
        error: {
          code: "validation_error",
          message: "Invalid request",
          details: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      { status: 400 },
    );
  }
  logger.error("Unhandled API error", {
    error: error instanceof Error ? error.message : String(error),
  });
  return NextResponse.json<ApiFailure>(
    { error: { code: "internal_error", message: "Internal server error" } },
    { status: 500 },
  );
}

/** Wraps a handler so thrown errors become consistent JSON responses. */
export function handle<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return fail(error);
    }
  };
}
