import { describe, expect, it } from "vitest";
import {
  TOTAL_BASIS_POINTS,
  allocateBySegmentDistance,
  createRoadFareAllocationService,
  weightsToBasisPoints,
} from "@/modules/payments/domain/fare-allocation";
import {
  RoutingError,
  type RoutingProvider,
} from "@/modules/routing/domain/routing-provider";

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

describe("allocateBySegmentDistance", () => {
  it("splits a shared leg equally and charges later stops for the extra road", () => {
    // 3 riders: leg 1 (6km) shared by 3, leg 2 (3km) by 2, leg 3 (3km) by 1.
    // Weights: 2000, 2000+1500, 2000+1500+3000 -> 2000/3500/6500 of 12000.
    expect(allocateBySegmentDistance([6000, 3000, 3000])).toEqual([
      1667, 2917, 5416,
    ]);
  });

  it("charges everyone equally when all stops coincide with the first", () => {
    expect(allocateBySegmentDistance([5000, 0, 0])).toEqual([3334, 3333, 3333]);
  });

  it("returns 100% for a single rider and [] for none", () => {
    expect(allocateBySegmentDistance([4200])).toEqual([10_000]);
    expect(allocateBySegmentDistance([])).toEqual([]);
  });

  it("falls back to an equal split when every leg is zero", () => {
    expect(allocateBySegmentDistance([0, 0])).toEqual([5000, 5000]);
  });

  it("always sums to exactly 10_000 and is non-decreasing", () => {
    const bps = allocateBySegmentDistance([1234, 5678, 91, 4321]);
    expect(bps.reduce((a, b) => a + b, 0)).toBe(TOTAL_BASIS_POINTS);
    expect(bps.every((v, i) => i === 0 || v >= bps[i - 1])).toBe(true);
  });

  it("rejects invalid distances", () => {
    expect(() => allocateBySegmentDistance([-1])).toThrow(RangeError);
    expect(() => allocateBySegmentDistance([Number.NaN])).toThrow(RangeError);
  });
});

describe("createRoadFareAllocationService", () => {
  const origin = { latitude: 0, longitude: 0 };
  const stops = ["a", "b"].map((participantId, i) => ({
    participantId,
    destination: { latitude: i + 1, longitude: i + 1 },
  }));

  function routingWith(distances: number[]): RoutingProvider {
    return {
      estimateDistance: async () => 0,
      estimateDuration: async () => 0,
      estimateRoute: async (waypoints) => ({
        legs: distances.map((distanceMeters, i) => ({
          from: waypoints[i],
          to: waypoints[i + 1],
          distanceMeters,
          durationSeconds: 0,
        })),
        totalDistanceMeters: distances.reduce((a, b) => a + b, 0),
        totalDurationSeconds: 0,
      }),
    };
  }

  it("maps shares back to participants in stop order", async () => {
    const service = createRoadFareAllocationService(routingWith([4000, 2000]));
    // weights 2000, 2000+2000 -> 1/3 and 2/3
    expect(await service.allocate(origin, stops)).toEqual([
      { participantId: "a", shareBps: 3333 },
      { participantId: "b", shareBps: 6667 },
    ]);
  });

  it("does not call routing when there are no stops", async () => {
    const service = createRoadFareAllocationService({
      ...routingWith([]),
      estimateRoute: () => Promise.reject(new Error("should not be called")),
    });
    expect(await service.allocate(origin, [])).toEqual([]);
  });

  it("fails loudly on a leg-count mismatch instead of guessing", async () => {
    const service = createRoadFareAllocationService(routingWith([4000]));
    await expect(service.allocate(origin, stops)).rejects.toBeInstanceOf(
      RoutingError,
    );
  });

  it("propagates routing failures with no straight-line fallback", async () => {
    const failing = routingWith([]);
    failing.estimateRoute = () => Promise.reject(new RoutingError("down"));
    await expect(
      createRoadFareAllocationService(failing).allocate(origin, stops),
    ).rejects.toThrow("down");
  });
});
