import { describe, expect, it } from "vitest";
import {
  affinityOf,
  affinityScore,
  boundingBox,
  closesAtFor,
  departureFor,
  haversineMeters,
} from "@/modules/sessions/domain/affinity";

const miraflores = { latitude: -12.1219, longitude: -77.0297 };
const sanIsidro = { latitude: -12.0977, longitude: -77.0365 };
const callao = { latitude: -12.0566, longitude: -77.1181 };
const t0 = new Date("2026-10-18T20:00:00Z");
const group = { pickup: miraflores, destination: callao, departsAt: t0 };

describe("haversineMeters", () => {
  it("is zero for the same point and symmetric", () => {
    expect(haversineMeters(miraflores, miraflores)).toBe(0);
    expect(haversineMeters(miraflores, sanIsidro)).toBeCloseTo(
      haversineMeters(sanIsidro, miraflores),
      6,
    );
  });
  it("matches a known city-scale distance", () => {
    // About 2.8 km between these two Lima districts.
    const meters = haversineMeters(miraflores, sanIsidro);
    expect(meters).toBeGreaterThan(2600);
    expect(meters).toBeLessThan(3000);
  });
});

describe("boundingBox", () => {
  it("contains points within the radius", () => {
    const box = boundingBox(miraflores, 1500);
    const near = { latitude: -12.1219 + 0.012, longitude: -77.0297 };
    expect(near.latitude).toBeLessThan(box.maxLat);
    expect(box.minLat).toBeLessThan(miraflores.latitude);
    expect(box.maxLon).toBeGreaterThan(miraflores.longitude);
  });
});

describe("affinityOf", () => {
  const intent = { origin: miraflores, destination: callao, departsAt: t0 };
  it("fits an identical request perfectly", () => {
    const a = affinityOf(group, intent)!;
    expect(a).toEqual({
      pickupMeters: 0,
      destinationMeters: 0,
      departureMinutes: 0,
    });
    expect(affinityScore(a)).toBe(0);
  });
  it("rejects a far-away pickup", () => {
    expect(affinityOf(group, { ...intent, origin: sanIsidro })).toBeNull();
  });
  it("rejects a different destination", () => {
    expect(affinityOf(group, { ...intent, destination: sanIsidro })).toBeNull();
  });
  it("rejects a departure outside the window but accepts one inside", () => {
    const at = (min: number) => new Date(t0.getTime() + min * 60_000);
    expect(affinityOf(group, { ...intent, departsAt: at(45) })).toBeNull();
    expect(
      affinityOf(group, { ...intent, departsAt: at(-20) })?.departureMinutes,
    ).toBe(20);
  });
  it("scores a closer group better", () => {
    const close = affinityOf(group, intent)!;
    const farther = affinityOf(group, {
      ...intent,
      origin: { latitude: -12.1219 + 0.006, longitude: -77.0297 },
    })!;
    expect(affinityScore(close)).toBeLessThan(affinityScore(farther));
  });
});

describe("departure helpers", () => {
  it("adds minutes and a join grace period", () => {
    expect(departureFor(30, t0).getTime() - t0.getTime()).toBe(30 * 60_000);
    expect(closesAtFor(t0).getTime() - t0.getTime()).toBe(5 * 60_000);
  });
});
