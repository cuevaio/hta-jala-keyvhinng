import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoutingError } from "@/modules/routing/domain/routing-provider";
import { MatchingError } from "@/modules/matching/infrastructure/matching.repository";
import { ApiError } from "@/lib/http";
import { resetRateLimits } from "@/lib/rate-limit";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  match: vi.fn(),
  matched: vi.fn(),
  after: vi.fn(),
}));
// after() needs a Next request scope; run the scheduled task inline instead.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: mocks.after,
}));
vi.mock("@/modules/participants/infrastructure/browser-identity", () => ({
  requireIdentity: mocks.identity,
}));
vi.mock("@/lib/services", () => ({
  getServices: () => ({
    matching: { match: mocks.match },
    // No group has expired in these cases.
    parties: { sweep: async () => [] },
    roomEvents: { matched: mocks.matched },
  }),
}));
import { POST } from "@/app/api/sessions/[id]/match/route";
const id = "a3574ead-5049-4b3c-8487-871900b90a48";
function request(origin = "http://localhost:3000", sessionId = id) {
  return POST(
    new Request(`http://localhost:3000/api/sessions/${sessionId}/match`, {
      method: "POST",
      headers: { origin },
    }),
    { params: Promise.resolve({ id: sessionId }) },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  resetRateLimits();
  mocks.identity.mockResolvedValue({ userId: "account" });
  mocks.after.mockImplementation((task: () => unknown) => task());
  mocks.match.mockResolvedValue({
    createdPartyCount: 1,
    alreadyMatched: false,
  });
});
describe("matching HTTP boundary", () => {
  it("requires identity and same-origin mutations before executing matching", async () => {
    expect((await request("https://elsewhere.test")).status).toBe(403);
    expect(mocks.match).not.toHaveBeenCalled();
    mocks.identity.mockRejectedValue(
      new ApiError(401, "identity_required", "Sign in"),
    );
    expect((await request()).status).toBe(401);
    expect(mocks.match).not.toHaveBeenCalled();
  });
  it("validates session IDs and does not accept client matching constraints", async () => {
    expect((await request("http://localhost:3000", "invalid")).status).toBe(
      400,
    );
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.match).toHaveBeenCalledWith(id, "account");
    // The new party's other members hear about it after the response.
    expect(mocks.matched).toHaveBeenCalledWith(
      id,
      "account",
      expect.objectContaining({ createdPartyCount: 1 }),
    );
  });
  it.each([403, 409])(
    "maps application failure %i to the common envelope",
    async (status) => {
      mocks.match.mockRejectedValue(
        new MatchingError(status, "matching_conflict", "Try again"),
      );
      const response = await request();
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({
        error: { code: "matching_conflict", message: "Try again" },
      });
    },
  );
  it("returns a retryable routing outage without disclosing provider details", async () => {
    mocks.match.mockRejectedValue(
      new RoutingError("sensitive provider response"),
    );
    const response = await request();
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("routing_unavailable");
  });
  it("bounds repeated expensive requests per account", async () => {
    for (let n = 0; n < 6; n++) expect((await request()).status).toBe(200);
    expect((await request()).status).toBe(429);
    expect(mocks.match).toHaveBeenCalledTimes(6);
  });
});
