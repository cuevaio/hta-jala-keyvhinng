import { describe, expect, it } from "vitest";
import {
  TOTAL_BASIS_POINTS,
  weightsToBasisPoints,
} from "@/modules/payments/domain/fare-allocation";

describe("weightsToBasisPoints", () => {
  it("always sums to exactly 10_000", () => {
    for (const weights of [
      [1, 1, 1],
      [3, 2, 1],
      [1],
      [0.3, 0.3, 0.4],
      [7, 11, 13, 17, 19],
    ]) {
      const bps = weightsToBasisPoints(weights);
      expect(bps.reduce((a, b) => a + b, 0)).toBe(TOTAL_BASIS_POINTS);
      expect(bps.every(Number.isInteger)).toBe(true);
    }
  });

  it("splits three equal weights as 3334/3333/3333", () => {
    expect(weightsToBasisPoints([1, 1, 1])).toEqual([3334, 3333, 3333]);
  });

  it("falls back to an equal split when all weights are zero", () => {
    expect(weightsToBasisPoints([0, 0])).toEqual([5000, 5000]);
  });

  it("handles empty input and rejects invalid weights", () => {
    expect(weightsToBasisPoints([])).toEqual([]);
    expect(() => weightsToBasisPoints([1, -1])).toThrow(RangeError);
    expect(() => weightsToBasisPoints([Number.NaN])).toThrow(RangeError);
  });
});
