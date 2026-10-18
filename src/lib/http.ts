import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { NotFoundError } from "@/lib/errors";
import { describeError, logger } from "@/lib/logger";
import { currentRequest, routeOf, runWithRequest } from "@/lib/request-context";

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
      {
        error: {
          code: "not_found",
          message: "No encontramos lo que buscas.",
        },
      },
      { status: 404 },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json<ApiFailure>(
      {
        error: {
          code: "validation_error",
          message: "Revisa los datos e inténtalo de nuevo.",
          details: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      { status: 400 },
    );
  }
  logger.error("http.unhandled_error", describeError(error));
  const requestId = currentRequest()?.requestId;
  return NextResponse.json<ApiFailure>(
    {
      error: {
        code: "internal_error",
        message: "Algo salió mal de nuestro lado. Inténtalo de nuevo.",
        // Lets support find this exact failure in the logs.
        ...(requestId && { details: { requestId } }),
      },
    },
    { status: 500 },
  );
}

/**
 * Wraps a handler so thrown errors become consistent JSON responses, and every
 * request gets an id (`x-request-id`) and one summary log line. Reads (polls) log at
 * debug so routine polling stays out of production logs.
 */
export function handle<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
) {
  return async (...args: A): Promise<Response> => {
    const request = args[0] instanceof Request ? args[0] : null;
    const context = {
      requestId: crypto.randomUUID(),
      method: request?.method ?? "UNKNOWN",
      route: request ? routeOf(request.url) : "unknown",
    };
    return runWithRequest(context, async () => {
      const started = performance.now();
      let response: Response;
      let code: string | undefined;
      try {
        response = await fn(...args);
      } catch (error) {
        response = fail(error);
        code =
          error instanceof ApiError
            ? error.code
            : error instanceof ZodError
              ? "validation_error"
              : error instanceof NotFoundError
                ? "not_found"
                : "internal_error";
      }
      response.headers.set("x-request-id", context.requestId);
      const status = response.status;
      // 4xx are expected outcomes (full room, wrong password); only abuse warns.
      const level =
        status >= 500
          ? "error"
          : status === 429
            ? "warn"
            : context.method === "GET" && status < 400
              ? "debug"
              : "info";
      logger[level]("http.request", {
        method: context.method,
        route: context.route,
        status,
        ...(code && { code }),
        durationMs: Math.round(performance.now() - started),
      });
      return response;
    });
  };
}

/** JSON mutations are same-origin; reject cross-site requests before any write. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError(
      403,
      "invalid_origin",
      "Solicitud de otro sitio no permitida.",
    );
  }
}

export async function readJson(request: Request, maxLength = 8192) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(415, "json_required", "Envía los datos como JSON.");
  }
  const body = await request.text();
  if (body.length > maxLength)
    throw new ApiError(413, "body_too_large", "Solicitud demasiado grande.");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ApiError(400, "invalid_json", "JSON inválido.");
  }
}
