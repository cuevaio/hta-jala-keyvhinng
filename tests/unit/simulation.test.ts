import { describe, expect, it } from "vitest";
import { simulate } from "@/modules/simulation/domain/simulation";
import { apportionMinor } from "@/modules/payments/domain/fare-allocation";

describe("validation simulator", () => {
  it.each([24, 60, 120, 240])(
    "places all %i people exactly once within vehicle and detour limits",
    (count) => {
      const result = simulate(count, 4, 40, 42);
      const ids = result.groups.flatMap((g) => g.stops.map((p) => p.id));
      expect(ids).toHaveLength(count);
      expect(new Set(ids).size).toBe(count);
      for (const group of result.groups) {
        expect(group.stops.length).toBeGreaterThan(0);
        expect(group.stops.length).toBeLessThanOrEqual(4);
        expect(group.shares.reduce((a, b) => a + b, 0)).toBe(10000);
        expect(group.detours.every((d) => d <= 0.6 + 1e-9)).toBe(true);
        expect(
          apportionMinor(2850, group.shares).reduce((a, b) => a + b, 0),
        ).toBe(2850);
      }
      expect(result.sharedKm).toBeLessThanOrEqual(result.directKm);
      expect(result.averageDetour).toBeGreaterThanOrEqual(-1e-9);
    },
  );
  it("honors a smaller capacity and reproduces the same seeded scenario", () => {
    const first = simulate(60, 3, 25, 5);
    expect(first).toEqual(simulate(60, 3, 25, 5));
    expect(first.groups.every((g) => g.stops.length <= 3)).toBe(true);
    expect(first.points).not.toEqual(simulate(60, 3, 25, 6).points);
  });
  it.each([
    [0, 4, 40],
    [241, 4, 40],
    [60, 2, 40],
    [60, 4, 0],
  ])("rejects unsupported configuration", (count, capacity, tolerance) => {
    expect(() => simulate(count, capacity, tolerance, 42)).toThrow(RangeError);
  });
});
