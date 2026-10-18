import { describe, expect, it } from "vitest";
import { clientEventBatch } from "@/lib/client-events";

const event = { type: "click", path: "/ride", target: "button:Buscar", at: 10 };

describe("client event batches", () => {
  it("accepts a batch of presses from one tab", () => {
    expect(
      clientEventBatch.safeParse({ tab: "tab-12345", events: [event] }).success,
    ).toBe(true);
  });
  it.each([
    { tab: "tab-12345", events: [] },
    { tab: "tab-12345", events: Array(26).fill(event) },
    { tab: "tab-12345", events: [{ ...event, type: "keystroke" }] },
    { tab: "tab-12345", events: [{ ...event, path: "https://evil.example" }] },
    { tab: "tab-12345", events: [{ ...event, target: "x".repeat(101) }] },
    { tab: "short", events: [event] },
  ])("rejects malformed or oversized batches %#", (batch) => {
    expect(clientEventBatch.safeParse(batch).success).toBe(false);
  });
});
