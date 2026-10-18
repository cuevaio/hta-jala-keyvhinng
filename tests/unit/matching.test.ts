import { describe, expect, it } from "vitest";
import { createRoadMatchingService } from "@/modules/matching/domain/road-matching";
import {
  RoutingError,
  type RoutingProvider,
} from "@/modules/routing/domain/routing-provider";
import type { MatchingCandidate } from "@/modules/matching/domain/matching";

const origin = { latitude: 0, longitude: 0 };
const constraints = { origin, vehicleCapacity: 3, maxDetourSeconds: 30 };
const candidate = (id: number, delegate = false): MatchingCandidate => ({
  participantId: `p${id}`,
  userId: `u${id}`,
  destination: { latitude: id, longitude: 0 },
  delegatePreference: delegate ? "delegate" : "passenger",
});
// Directed road times, indexed by waypoint latitude. Distances deliberately differ.
function provider(
  matrix: (number | null)[][],
  sharedExtra = 0,
): RoutingProvider {
  return {
    estimateMatrix: async (points) => ({
      durationsSeconds: points.map((a) =>
        points.map((b) => matrix[a.latitude][b.latitude]),
      ),
    }),
    estimateDuration: async (a, b) => matrix[a.latitude][b.latitude]!,
    estimateDistance: async () => 100,
    estimateRoute: async (points) => {
      const legs = points.slice(1).map((to, i) => ({
        from: points[i],
        to,
        durationSeconds: matrix[points[i].latitude][to.latitude]! + sharedExtra,
        distanceMeters: 100 * (i + 1),
      }));
      return {
        legs,
        totalDurationSeconds: legs.reduce((n, l) => n + l.durationSeconds, 0),
        totalDistanceMeters: legs.reduce((n, l) => n + l.distanceMeters, 0),
      };
    },
  };
}
const linear = Array.from({ length: 13 }, (_, i) =>
  Array.from({ length: 13 }, (_, j) => Math.abs(i - j) * 100),
);

describe("road matching", () => {
  it("forms groups with ordered exact stops and exactly one willing delegate", async () => {
    const result = await createRoadMatchingService(provider(linear)).match(
      [candidate(3), candidate(1, true), candidate(2)],
      constraints,
    );
    expect(result.unmatched).toEqual([]);
    expect(result.parties).toHaveLength(1);
    expect(
      result.parties[0].members.map((m) => [
        m.participantId,
        m.role,
        m.dropOffOrder,
      ]),
    ).toEqual([
      ["p1", "delegate", 1],
      ["p2", "passenger", 2],
      ["p3", "passenger", 3],
    ]);
    expect(result.parties[0].directDurationSeconds).toEqual([100, 200, 300]);
  });
  it("leaves passengers and single volunteers waiting without routing", async () => {
    const broken: RoutingProvider = {
      ...provider(linear),
      estimateMatrix: async () => {
        throw new Error("must not route");
      },
    };
    for (const people of [
      [],
      [candidate(1, true)],
      [candidate(1), candidate(2)],
    ]) {
      expect(
        await createRoadMatchingService(broken).match(people, constraints),
      ).toEqual({ parties: [], unmatched: people });
    }
  });
  it("respects vehicle capacity, never assigns twice, and returns leftovers", async () => {
    const people = [
      candidate(1, true),
      candidate(2),
      candidate(3, true),
      candidate(4),
      candidate(5),
    ];
    const result = await createRoadMatchingService(provider(linear)).match(
      people,
      { ...constraints, vehicleCapacity: 2 },
    );
    expect(result.parties).toHaveLength(2);
    expect(result.unmatched).toHaveLength(1);
    expect(result.parties.every((p) => p.members.length === 2)).toBe(true);
    expect(
      new Set([
        ...result.parties.flatMap((p) => p.members.map((m) => m.participantId)),
        ...result.unmatched.map((c) => c.participantId),
      ]).size,
    ).toBe(5);
  });
  it("rejects incompatible destinations in both directed stop orders", async () => {
    const roads = [
      [0, 100, 100],
      [100, 0, 500],
      [100, 500, 0],
    ];
    const result = await createRoadMatchingService(provider(roads)).match(
      [candidate(1, true), candidate(2)],
      constraints,
    );
    expect(result.parties).toEqual([]);
    expect(result.unmatched).toHaveLength(2);
  });
  it("accepts the exact detour boundary and uses directed travel times", async () => {
    const roads = [
      [0, 100, 100],
      [100, 0, 30],
      [100, 500, 0],
    ];
    const people = [candidate(2), candidate(1, true)];
    expect(
      (
        await createRoadMatchingService(provider(roads)).match(
          people,
          constraints,
        )
      ).parties,
    ).toHaveLength(1);
    expect(
      (
        await createRoadMatchingService(provider(roads)).match(people, {
          ...constraints,
          maxDetourSeconds: 29,
        })
      ).parties,
    ).toEqual([]);
  });
  it("keeps unreachable destinations waiting", async () => {
    const roads = [
      [0, 100, null],
      [100, 0, null],
      [null, null, 0],
    ];
    expect(
      (
        await createRoadMatchingService(provider(roads)).match(
          [candidate(1, true), candidate(2)],
          constraints,
        )
      ).unmatched,
    ).toHaveLength(2);
  });
  it("rechecks detours on the actual multi-stop route", async () => {
    const result = await createRoadMatchingService(provider(linear, 100)).match(
      [candidate(1, true), candidate(2)],
      constraints,
    );
    expect(result.parties).toEqual([]);
  });
  it("rejects bad input and malformed provider responses", async () => {
    const engine = createRoadMatchingService(provider(linear));
    await expect(
      engine.match([candidate(1), candidate(1)], constraints),
    ).rejects.toThrow(RangeError);
    await expect(
      engine.match([], { ...constraints, vehicleCapacity: 1 }),
    ).rejects.toThrow(RangeError);
    await expect(
      engine.match([], { ...constraints, maxDetourSeconds: -1 }),
    ).rejects.toThrow(RangeError);
    await expect(
      engine.match(
        Array.from({ length: 13 }, (_, i) => candidate(i)),
        constraints,
      ),
    ).rejects.toThrow(RangeError);
    await expect(
      createRoadMatchingService({
        ...provider(linear),
        estimateMatrix: async () => ({ durationsSeconds: [[NaN]] }),
      }).match([candidate(1, true), candidate(2)], constraints),
    ).rejects.toThrow(RoutingError);
  });
  it("propagates routing failures instead of fabricating straight-line estimates", async () => {
    await expect(
      createRoadMatchingService({
        ...provider(linear),
        estimateRoute: async () => {
          throw new RoutingError("offline");
        },
      }).match([candidate(1, true), candidate(2)], constraints),
    ).rejects.toThrow("offline");
  });
  it("is deterministic and preserves invariants over varied directed road networks", async () => {
    let seed = 42;
    const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) % 1000;
    for (let trial = 0; trial < 30; trial++) {
      const roads = Array.from({ length: 8 }, (_, i) =>
        Array.from({ length: 8 }, (_, j) => (i === j ? 0 : random())),
      );
      const people = Array.from({ length: 7 }, (_, i) =>
        candidate(i + 1, i % 3 === 0),
      );
      const engine = createRoadMatchingService(provider(roads));
      const result = await engine.match(people, constraints);
      expect(await engine.match(people, constraints)).toEqual(result);
      const ids = [
        ...result.parties.flatMap((p) => p.members.map((m) => m.participantId)),
        ...result.unmatched.map((c) => c.participantId),
      ];
      expect(ids.sort()).toEqual(people.map((c) => c.participantId).sort());
      for (const party of result.parties) {
        expect(party.members.length).toBeGreaterThanOrEqual(2);
        expect(party.members.length).toBeLessThanOrEqual(3);
        expect(party.members.filter((m) => m.role === "delegate")).toHaveLength(
          1,
        );
        let elapsed = 0;
        party.members.forEach((m, i) => {
          if (m.role === "delegate")
            expect(
              people.find((c) => c.participantId === m.participantId)
                ?.delegatePreference,
            ).toBe("delegate");
          elapsed += party.route.legs[i].durationSeconds;
          expect(elapsed - party.directDurationSeconds[i]).toBeLessThanOrEqual(
            constraints.maxDetourSeconds,
          );
        });
      }
    }
  });
});
