import type { GeoPoint } from "@/modules/events/domain/event";
import {
  RoutingError,
  type RoutingProvider,
} from "@/modules/routing/domain/routing-provider";

export const TOTAL_BASIS_POINTS = 10_000;

export interface FareAllocationStop {
  participantId: string;
  destination: GeoPoint;
}

export interface FareAllocation {
  participantId: string;
  /** Integer basis points; 10_000 = 100%. */
  shareBps: number;
}

/**
 * Recommends how a shared fare should be split.
 *
 * Contract:
 * - `origin` is where the vehicle starts (the meeting point).
 * - `orderedStops` is the shared route in drop-off order.
 * - Returns exactly one allocation per stop, in the same order.
 * - Every `shareBps` is a non-negative integer and the sum is exactly
 *   TOTAL_BASIS_POINTS. The actual taxi fare is never needed.
 */
export interface FareAllocationService {
  allocate(
    origin: GeoPoint,
    orderedStops: readonly FareAllocationStop[],
  ): Promise<FareAllocation[]>;
}

/**
 * Converts non-negative weights into integer basis points summing to exactly 10_000,
 * using the largest-remainder method. Implementations of FareAllocationService
 * can use this to guarantee the sum invariant.
 */
export function weightsToBasisPoints(weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new RangeError("Weights must be finite and non-negative");
  }
  const total = weights.reduce((a, b) => a + b, 0);
  const normalized = total === 0 ? weights.map(() => 1) : [...weights];
  const sum = total === 0 ? weights.length : total;

  const exact = normalized.map((w) => (w / sum) * TOTAL_BASIS_POINTS);
  const result = exact.map(Math.floor);
  let remaining = TOTAL_BASIS_POINTS - result.reduce((a, b) => a + b, 0);

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (remaining <= 0) break;
    result[index] += 1;
    remaining -= 1;
  }
  return result;
}

/**
 * Segment-based shares from road distances.
 *
 * `legDistancesMeters[i]` is the leg that ends at stop `i`, so it is shared by
 * everyone not yet dropped off: members `i..n-1`. Each leg is split equally among
 * them and each member's contributions are accumulated, then normalized to basis
 * points. A passenger who rides further therefore pays more, and nobody pays for
 * road travelled after leaving. This is a distance-based recommendation, not the
 * provider's metered fare.
 */
export function allocateBySegmentDistance(
  legDistancesMeters: readonly number[],
): number[] {
  const n = legDistancesMeters.length;
  const weights: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < n; i++) {
    const distance = legDistancesMeters[i];
    if (!Number.isFinite(distance) || distance < 0) {
      throw new RangeError("Leg distances must be finite and non-negative");
    }
    cumulative += distance / (n - i);
    weights.push(cumulative);
  }
  return weightsToBasisPoints(weights);
}

/**
 * Road-distance implementation of FareAllocationService. Routing failures propagate
 * as RoutingError; there is deliberately no straight-line fallback.
 */
export function createRoadFareAllocationService(
  routing: RoutingProvider,
): FareAllocationService {
  return {
    async allocate(origin, orderedStops) {
      if (orderedStops.length === 0) return [];
      const route = await routing.estimateRoute([
        origin,
        ...orderedStops.map((stop) => stop.destination),
      ]);
      if (route.legs.length !== orderedStops.length) {
        throw new RoutingError(
          `Expected ${orderedStops.length} route legs, received ${route.legs.length}`,
        );
      }
      const shares = allocateBySegmentDistance(
        route.legs.map((leg) => leg.distanceMeters),
      );
      return orderedStops.map((stop, index) => ({
        participantId: stop.participantId,
        shareBps: shares[index],
      }));
    },
  };
}
