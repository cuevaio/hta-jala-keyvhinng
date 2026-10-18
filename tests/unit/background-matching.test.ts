import { describe, expect, it, vi } from "vitest";
import { createMatchingApplication } from "@/modules/matching/application/matching.service";
import {
  MatchingError,
  type MatchingRepository,
} from "@/modules/matching/infrastructure/matching.repository";
import type { MatchingService } from "@/modules/matching/domain/matching";
import { RoutingError } from "@/modules/routing/domain/routing-provider";

const changed = () =>
  new MatchingError(409, "matching_snapshot_changed", "changed");

function app(snapshot: () => Promise<unknown>) {
  const repo = { snapshot: vi.fn(snapshot), commit: vi.fn() };
  return {
    repo,
    matching: createMatchingApplication(
      repo as unknown as MatchingRepository,
      {} as MatchingService,
      "fixture",
    ),
  };
}

describe("background matching", () => {
  it("retries when the room changed under it", async () => {
    const { repo, matching } = app(
      vi
        .fn()
        .mockRejectedValueOnce(changed())
        .mockResolvedValue({ kind: "assigned" }),
    );
    expect(await matching.matchInBackground("s", "u")).toMatchObject({
      alreadyMatched: true,
    });
    expect(repo.snapshot).toHaveBeenCalledTimes(2);
  });

  it("gives up after three attempts without throwing", async () => {
    const { repo, matching } = app(() => Promise.reject(changed()));
    expect(await matching.matchInBackground("s", "u")).toBeNull();
    expect(repo.snapshot).toHaveBeenCalledTimes(3);
  });

  it.each([
    new MatchingError(409, "session_unavailable", "closed"),
    new RoutingError("routing down"),
    new Error("database down"),
  ])("swallows %s so the request that triggered it stays done", async (e) => {
    const { repo, matching } = app(() => Promise.reject(e));
    expect(await matching.matchInBackground("s", "u")).toBeNull();
    expect(repo.snapshot).toHaveBeenCalledTimes(1);
  });
});
