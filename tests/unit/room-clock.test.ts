import { describe, expect, it, vi } from "vitest";
import {
  createRoomClock,
  roomDeadline,
} from "@/components/sessions/room-clock";

const serverNow = "2026-10-18T12:00:00.000Z";
const base = Date.parse(serverNow);
describe("room deadline clock", () => {
  it("ignores device clock skew and subsequent clock changes", () => {
    let elapsed = 100;
    const clock = createRoomClock(serverNow, () => elapsed);
    const wall = vi.spyOn(Date, "now").mockReturnValue(base + 86_400_000);
    try {
      expect(clock.now()).toBe(base);
      elapsed += 20_000;
      wall.mockReturnValue(base - 86_400_000);
      expect(clock.now()).toBe(base + 20_000);
    } finally {
      wall.mockRestore();
    }
  });
  it("catches up after a suspended tab without counting interval callbacks", () => {
    let elapsed = 0;
    const clock = createRoomClock(serverNow, () => elapsed);
    elapsed = 90_000;
    expect(roomDeadline("2026-10-18T12:01:00Z", clock.now()).phase).toBe(
      "closed",
    );
  });
  it("resynchronizes from server time and ignores older responses", () => {
    let elapsed = 0;
    const clock = createRoomClock(serverNow, () => elapsed);
    elapsed = 1000;
    clock.synchronize("2026-10-18T12:00:10Z", 200);
    expect(clock.now()).toBe(base + 10_100);
    clock.synchronize(serverNow);
    clock.synchronize("invalid");
    elapsed += 900;
    expect(clock.now()).toBe(base + 11_000);
  });
  it("caps uncertain transport compensation for slow requests", () => {
    const clock = createRoomClock(serverNow, () => 0);
    clock.synchronize(serverNow, 20_000);
    expect(clock.now()).toBe(base + 1000);
  });
  it.each([
    [300_001, "open", "5:01"],
    [300_000, "closing", "5:00"],
    [1001, "closing", "0:02"],
    [1, "closing", "0:01"],
    [0, "closed", "0:00"],
    [-1000, "closed", "0:00"],
  ])("handles remaining %i ms", (remaining, phase, label) => {
    expect(
      roomDeadline(new Date(base + remaining).toISOString(), base),
    ).toMatchObject({ phase, label });
  });
});
