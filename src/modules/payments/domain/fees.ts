/** Credit every new account starts with: PEN 5.00, in minor units (céntimos). */
export const WELCOME_CREDIT_MINOR = 500;

/** Platform fee per completed ride: PEN 1.00, in minor units (céntimos). */
export const PLATFORM_FEE_MINOR = 100;

export const FEE_ENTRY_TYPES = ["platform_fee", "free_ride_waiver"] as const;
export type FeeEntryType = (typeof FEE_ENTRY_TYPES)[number];

export interface FeeDecision {
  entryType: FeeEntryType;
  /** Amount in minor units debited from the user's credit. Zero for waivers. */
  amountMinor: number;
}

/** Platform fee for one completed ride. Delegates never pay; passengers pay PEN 1.00. */
export function calculatePlatformFee(input: {
  role: "delegate" | "passenger";
}): FeeDecision {
  if (input.role === "delegate")
    return { entryType: "free_ride_waiver", amountMinor: 0 };
  return { entryType: "platform_fee", amountMinor: PLATFORM_FEE_MINOR };
}

/** Whether a balance covers one ride as a passenger (the role matching may assign). */
export const canAffordRide = (balanceMinor: number) =>
  balanceMinor >= PLATFORM_FEE_MINOR;

/** Display format for soles, e.g. 490 → "S/ 4.90". */
export const formatSoles = (minor: number) =>
  `${minor < 0 ? "-" : ""}S/ ${(Math.abs(minor) / 100).toFixed(2)}`;
