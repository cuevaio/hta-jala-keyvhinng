import { describe, expect, it } from "vitest";
import {
  haversineMeters,
  DESTINATION_RADIUS_METERS,
} from "@/modules/sessions/domain/affinity";
import {
  publicAnchor,
  publicDestination,
} from "@/modules/sessions/domain/public-room";

describe("publicAnchor", () => {
  it("snaps to a ~1 km grid that stays well inside the matching radius", () => {
    const home = { latitude: -12.123456, longitude: -77.034567 };
    const anchor = publicAnchor(home);
    expect(anchor).toEqual({ latitude: -12.12, longitude: -77.03 });
    expect(haversineMeters(home, anchor)).toBeLessThan(800);
    expect(haversineMeters(home, anchor)).toBeLessThan(
      DESTINATION_RADIUS_METERS / 3,
    );
  });

  it("gives every address in the same cell the same anchor", () => {
    expect(publicAnchor({ latitude: -12.1211, longitude: -77.0288 })).toEqual(
      publicAnchor({ latitude: -12.1249, longitude: -77.0251 }),
    );
  });
});

describe("publicDestination", () => {
  it("names the room after the district only", () => {
    expect(publicDestination(" Barranco ")).toEqual({
      name: "Hacia Barranco",
      label: "Barranco",
    });
  });

  it("falls back to a generic name instead of the typed address", () => {
    expect(publicDestination(undefined)).toEqual({
      name: "Hacia un destino cercano",
      label: "Destino cercano",
    });
  });
});
