import type { GeoPoint } from "@/modules/places/domain/place";
import {
  RoutingError,
  type RoutingProvider,
} from "@/modules/routing/domain/routing-provider";
import type { CandidateParty, MatchingService } from "./matching";

export const MATCHING_BATCH_SIZE = 12;
export const MAX_DETOUR_SECONDS = 5 * 60;
/** Hard ceiling on party size: a taxi seats four passengers, even when the vehicle is larger. */
export const MAX_PARTY_SIZE = 4;

function validPoint(p: GeoPoint) {
  return (
    Number.isFinite(p.latitude) &&
    Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.longitude) <= 180
  );
}

/** Bounded exhaustive stop-order search, followed by greedy disjoint group selection.
 * Groups are intentionally limited to four, even for a larger vehicle. No global
 * optimality is promised. Input order breaks ties, preserving waiting-list fairness.
 */
export function createRoadMatchingService(
  routing: RoutingProvider,
): MatchingService {
  return {
    async match(candidates, constraints) {
      if (
        !Number.isInteger(constraints.vehicleCapacity) ||
        constraints.vehicleCapacity < 2 ||
        constraints.vehicleCapacity > 8 ||
        !Number.isFinite(constraints.maxDetourSeconds) ||
        constraints.maxDetourSeconds < 0 ||
        !validPoint(constraints.origin) ||
        candidates.length > MATCHING_BATCH_SIZE ||
        candidates.some(
          (c) =>
            !validPoint(c.destination) ||
            !["delegate", "passenger"].includes(c.delegatePreference),
        ) ||
        new Set(candidates.map((c) => c.participantId)).size !==
          candidates.length ||
        new Set(candidates.map((c) => c.userId)).size !== candidates.length
      ) {
        throw new RangeError("Invalid matching candidates or constraints");
      }
      if (
        candidates.length < 2 ||
        !candidates.some((c) => c.delegatePreference === "delegate")
      ) {
        return { parties: [], unmatched: [...candidates] };
      }
      const points = [
        constraints.origin,
        ...candidates.map((c) => c.destination),
      ];
      let durations: (number | null)[][];
      if (routing.estimateMatrix) {
        durations = (await routing.estimateMatrix(points)).durationsSeconds;
      } else {
        // Small-provider fallback: bounded concurrency, never unbounded Promise.all.
        durations = points.map(() => points.map(() => 0));
        const jobs = points
          .flatMap((from, i) => points.map((to, j) => ({ from, to, i, j })))
          .filter((j) => j.i !== j.j);
        let next = 0;
        await Promise.all(
          Array.from({ length: 6 }, async () => {
            while (next < jobs.length) {
              const { from, to, i, j } = jobs[next++];
              durations[i][j] = await routing.estimateDuration(from, to);
            }
          }),
        );
      }
      if (
        durations.length !== points.length ||
        durations.some(
          (row) =>
            row.length !== points.length ||
            row.some((t) => t !== null && (!Number.isFinite(t) || t < 0)),
        )
      ) {
        throw new RoutingError("Invalid routing matrix");
      }
      const options: { order: number[]; detour: number; duration: number }[] =
        [];
      function search(order: number[], elapsed: number, detour: number) {
        if (
          order.length >= 2 &&
          order.some((i) => candidates[i].delegatePreference === "delegate")
        ) {
          options.push({ order, detour, duration: elapsed });
        }
        if (
          order.length >= Math.min(MAX_PARTY_SIZE, constraints.vehicleCapacity)
        )
          return;
        for (let i = 0; i < candidates.length; i++) {
          if (order.includes(i)) continue;
          const direct = durations[0][i + 1];
          const leg =
            durations[order.length ? order[order.length - 1] + 1 : 0][i + 1];
          if (direct === null || leg === null) continue;
          const arrival = elapsed + leg;
          const extra = Math.max(0, arrival - direct);
          if (extra <= constraints.maxDetourSeconds)
            search([...order, i], arrival, detour + extra);
        }
      }
      search([], 0, 0);
      options.sort(
        (a, b) =>
          b.order.length - a.order.length ||
          a.detour - b.detour ||
          a.duration - b.duration,
      );
      const assigned = new Set<number>();
      const parties: CandidateParty[] = [];
      let verifications = 0;
      for (const option of options) {
        if (option.order.some((i) => assigned.has(i))) continue;
        // Bound external work even when the matrix and full-route constraints disagree.
        if (verifications++ >= 8) break;
        const ordered = option.order.map((i) => candidates[i]);
        // Verify the actual multi-stop route: turn constraints can differ from matrix legs.
        const route = await routing.estimateRoute([
          constraints.origin,
          ...ordered.map((c) => c.destination),
        ]);
        if (
          route.legs.length !== ordered.length ||
          route.legs.some(
            (l) =>
              !Number.isFinite(l.durationSeconds) ||
              l.durationSeconds < 0 ||
              !Number.isFinite(l.distanceMeters) ||
              l.distanceMeters < 0,
          )
        ) {
          throw new RoutingError("Invalid shared route legs");
        }
        let elapsed = 0;
        const direct = option.order.map((i) => durations[0][i + 1]!);
        if (
          route.legs.some((leg, i) => {
            elapsed += leg.durationSeconds;
            return elapsed - direct[i] > constraints.maxDetourSeconds;
          })
        )
          continue;
        const delegate = ordered.find(
          (c) => c.delegatePreference === "delegate",
        )!;
        parties.push({
          members: ordered.map((c, i) => ({
            participantId: c.participantId,
            userId: c.userId,
            role: c === delegate ? "delegate" : "passenger",
            dropOffOrder: i + 1,
          })),
          route,
          directDurationSeconds: direct,
        });
        option.order.forEach((i) => assigned.add(i));
      }
      return {
        parties,
        unmatched: candidates.filter((_, i) => !assigned.has(i)),
      };
    },
  };
}
