import { afterEach, describe, expect, it, vi } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { describeError, logger } from "@/lib/logger";
import { routeOf, runWithRequest } from "@/lib/request-context";

afterEach(() => vi.restoreAllMocks());

describe("describeError", () => {
  it("keeps the database cause but never the SQL or its parameters", () => {
    const cause = Object.assign(new Error('column "credit" does not exist'), {
      name: "PostgresError",
      code: "42703",
      routine: "errorMissingColumn",
      table_name: "users",
      column_name: "credit_balance_minor",
    });
    const error = new DrizzleQueryError(
      'select "email" from "users" where "email" = $1',
      ["ana@example.com"],
      cause,
    );
    const described = describeError(error);
    expect(described).toMatchObject({
      sqlState: "42703",
      table: "users",
      column: "credit_balance_minor",
    });
    const text = JSON.stringify(described);
    expect(text).not.toContain("ana@example.com");
    expect(text).not.toContain("select");
  });

  it("drops the message of a query error without a database cause", () => {
    const error = new DrizzleQueryError("select $1", ["Jr. Las Camelias 742"]);
    expect(JSON.stringify(describeError(error))).not.toContain("Camelias");
  });

  it("keeps ordinary error messages", () => {
    expect(describeError(new TypeError("boom"))).toMatchObject({
      errorType: "TypeError",
      errorMessage: "boom",
    });
  });
});

describe("request logging", () => {
  it("masks ids and drops the query string from routes", () => {
    expect(
      routeOf(
        "https://jala.test/api/sessions/0b7c9f1e-1a2b-4c3d-8e9f-001122334455/join?olat=-12.1",
      ),
    ).toBe("/api/sessions/:id/join");
  });

  it("stamps every line with the current request id", () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => {});
    runWithRequest(
      { requestId: "req-1", method: "POST", route: "/api/groups" },
      () => logger.info("room.create", { sessionId: "s1" }),
    );
    expect(JSON.parse(write.mock.calls[0][0] as string)).toMatchObject({
      level: "info",
      message: "room.create",
      requestId: "req-1",
      sessionId: "s1",
    });
  });

  it("sends warnings to the warning stream", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("http.request", { status: 429 });
    expect(warn).toHaveBeenCalledOnce();
  });
});
