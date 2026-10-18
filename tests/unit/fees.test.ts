import { describe, expect, it } from "vitest";
import { calculatePlatformFee } from "@/modules/payments/domain/fees";

describe("calculatePlatformFee", () => {
  it("waives the fee for the first five rides", () => {
    expect(
      calculatePlatformFee({ role: "passenger", completedRidesBefore: 4 }),
    ).toEqual({
      entryType: "free_ride_waiver",
      amountMinor: 0,
    });
  });

  it("charges PEN 0.10 from the sixth ride", () => {
    expect(
      calculatePlatformFee({ role: "passenger", completedRidesBefore: 5 }),
    ).toEqual({
      entryType: "platform_fee",
      amountMinor: 10,
    });
  });

  it("never charges delegates", () => {
    expect(
      calculatePlatformFee({ role: "delegate", completedRidesBefore: 50 })
        .amountMinor,
    ).toBe(0);
  });
});
