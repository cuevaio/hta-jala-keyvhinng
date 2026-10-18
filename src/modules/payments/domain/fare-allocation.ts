import type { GeoPoint } from "@/modules/events/domain/event";

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
 * - `orderedStops` is the shared route in drop-off order.
 * - Returns exactly one allocation per stop, in the same order.
 * - Every `shareBps` is a non-negative integer and the sum is exactly
 *   TOTAL_BASIS_POINTS. The actual taxi fare is never needed.
 */
export interface FareAllocationService {
  allocate(
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
