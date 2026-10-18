import { describe, expect, it } from "vitest";
import {
  MAX_BACKOFF_MS,
  nextPollDelay,
  POLL_MS,
} from "@/components/sessions/poll-delay";

describe("nextPollDelay", () => {
  it("polls at the steady rate with small jitter while healthy", () => {
    expect(nextPollDelay(0, () => 0)).toBe(Math.round(POLL_MS * 0.9));
    expect(nextPollDelay(0, () => 1)).toBe(Math.round(POLL_MS * 1.1));
  });

  it("backs off exponentially after failures", () => {
    expect(nextPollDelay(1, () => 1)).toBe(POLL_MS * 2);
    expect(nextPollDelay(2, () => 1)).toBe(POLL_MS * 4);
    expect(nextPollDelay(2, () => 0)).toBe(POLL_MS * 2);
  });

  it("never waits longer than the cap", () => {
    expect(nextPollDelay(50, () => 1)).toBe(MAX_BACKOFF_MS);
    expect(nextPollDelay(50, () => 0)).toBe(MAX_BACKOFF_MS / 2);
  });
});
