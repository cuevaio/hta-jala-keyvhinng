/** Number of completed rides after which a regular passenger starts paying the platform fee. */
export const FREE_RIDES_PER_PASSENGER = 5;

/** Proposed platform fee: PEN 0.10, in minor units (céntimos). */
export const PLATFORM_FEE_MINOR = 10;

export const FEE_ENTRY_TYPES = ["platform_fee", "free_ride_waiver"] as const;
export type FeeEntryType = (typeof FEE_ENTRY_TYPES)[number];

export interface FeeDecision {
  entryType: FeeEntryType;
  /** Amount in minor units. Zero for waivers. */
  amountMinor: number;
}

/**
 * Platform fee for one completed ride.
 * Delegates never pay; passengers ride free for their first five completed rides.
 */
export function calculatePlatformFee(input: {
  role: "delegate" | "passenger";
  completedRidesBefore: number;
}): FeeDecision {
  if (
    input.role === "delegate" ||
    input.completedRidesBefore < FREE_RIDES_PER_PASSENGER
  ) {
    return { entryType: "free_ride_waiver", amountMinor: 0 };
  }
  return { entryType: "platform_fee", amountMinor: PLATFORM_FEE_MINOR };
}
