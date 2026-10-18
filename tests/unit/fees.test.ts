import { describe, expect, it } from "vitest";
import {
  calculatePlatformFee,
  canAffordRide,
  formatSoles,
} from "@/modules/payments/domain/fees";

describe("calculatePlatformFee", () => {
  it("charges passengers PEN 1.00 per ride", () => {
    expect(calculatePlatformFee({ role: "passenger" })).toEqual({
      entryType: "platform_fee",
      amountMinor: 100,
    });
  });

  it("never charges delegates", () => {
    expect(calculatePlatformFee({ role: "delegate" })).toEqual({
      entryType: "free_ride_waiver",
      amountMinor: 0,
    });
  });
});

describe("canAffordRide", () => {
  it("requires at least one fee of credit", () => {
    expect(canAffordRide(100)).toBe(true);
    expect(canAffordRide(99)).toBe(false);
  });
});

describe("formatSoles", () => {
  it("formats minor units as soles", () => {
    expect(formatSoles(500)).toBe("S/ 5.00");
    expect(formatSoles(490)).toBe("S/ 4.90");
    expect(formatSoles(-10)).toBe("-S/ 0.10");
  });
});
