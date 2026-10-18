import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  list: vi.fn(),
  markRead: vi.fn(),
}));
vi.mock("@/modules/participants/infrastructure/browser-identity", () => ({
  requireIdentity: mocks.identity,
}));
vi.mock("@/lib/services", () => ({
  getServices: () => ({
    activity: { list: mocks.list, markRead: mocks.markRead },
  }),
}));
import { GET, POST } from "@/app/api/notifications/route";

const id = "a3574ead-5049-4b3c-8487-871900b90a48";
function post(body: unknown, origin = "http://localhost:3000") {
  return POST(
    new Request("http://localhost:3000/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify(body),
    }),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.identity.mockResolvedValue({ userId: "account" });
  mocks.list.mockResolvedValue({ items: [], unreadCount: 0 });
});
describe("notification HTTP boundary", () => {
  it("requires sign-in for reads and writes", async () => {
    mocks.identity.mockRejectedValue(
      new ApiError(401, "identity_required", "Sign in"),
    );
    expect((await GET()).status).toBe(401);
    expect((await post({ all: true })).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.markRead).not.toHaveBeenCalled();
  });
  it("keeps responses private and uses the authenticated account, never a caller-provided user", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.list).toHaveBeenCalledWith("account");
    expect((await post({ ids: [id] })).status).toBe(200);
    expect(mocks.markRead).toHaveBeenCalledWith("account", [id]);
    expect((await post({ all: true })).status).toBe(200);
    expect(mocks.markRead).toHaveBeenLastCalledWith("account", undefined);
  });
  it("rejects cross-origin requests and malformed read selections", async () => {
    expect((await post({ all: true }, "https://elsewhere.test")).status).toBe(
      403,
    );
    for (const body of [
      {},
      { ids: [] },
      { ids: ["bad"] },
      { ids: Array(31).fill(id) },
      { all: false },
      { all: true, userId: "other" },
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(mocks.markRead).not.toHaveBeenCalled();
  });
});
