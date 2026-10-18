import { describe, expect, it, vi } from "vitest";
import { reverseGeocode, searchAddress } from "@/lib/geocoding";

const point = { latitude: -12.1219, longitude: -77.0297 };

describe("reverseGeocode", () => {
  it("requests lat/lon in Spanish and returns the display name", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ display_name: "Av. Larco 345, Miraflores" }),
        ),
    );
    const address = await reverseGeocode(point, {
      fetch: fetchMock as unknown as typeof fetch,
    });
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("lat=-12.1219");
    expect(url).toContain("lon=-77.0297");
    expect(url).toContain("accept-language=es");
    expect(address).toBe("Av. Larco 345, Miraflores");
  });

  it.each([
    ["non-OK status", () => new Response("{}", { status: 429 })],
    ["no result", () => new Response(JSON.stringify({ error: "Unable" }))],
  ])("returns null on %s", async (_name, respond) => {
    expect(
      await reverseGeocode(point, {
        fetch: (async () => respond()) as unknown as typeof fetch,
      }),
    ).toBeNull();
  });
});

describe("searchAddress", () => {
  const feature = (
    coordinates: [number, number],
    properties: Record<string, string>,
  ) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates },
    properties,
  });

  it("searches Peru on Photon and builds labels from the address parts", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            type: "FeatureCollection",
            features: [
              feature([-77.03, -12.12], {
                name: "Parque Kennedy",
                street: "Avenida José Larco",
                housenumber: "345",
                district: "Miraflores",
                city: "Lima",
                state: "Lima",
              }),
              // Another segment of the same avenue: same label, dropped.
              feature([-77.04, -12.13], {
                name: "Parque Kennedy",
                street: "Avenida José Larco",
                housenumber: "345",
                district: "Miraflores",
                city: "Lima",
              }),
              feature([-77.08, -12.04], {
                name: "Avenida Morales Duarez",
                city: "Lima",
              }),
            ],
          }),
        ),
    );
    const matches = await searchAddress("larco", {
      fetch: fetchMock as unknown as typeof fetch,
    });
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("photon.komoot.io/api");
    expect(url).toContain("q=larco");
    expect(url).toContain("countrycode=PE");
    expect(url).toContain("lang=default");
    expect(matches).toEqual([
      {
        label: "Parque Kennedy, Avenida José Larco 345, Miraflores, Lima",
        point: { latitude: -12.12, longitude: -77.03 },
      },
      {
        label: "Avenida Morales Duarez, Lima",
        point: { latitude: -12.04, longitude: -77.08 },
      },
    ]);
  });

  it("returns an empty list on failure or unexpected data", async () => {
    for (const respond of [
      () => new Response("{}", { status: 429 }),
      () => new Response(JSON.stringify({ error: "nope" })),
    ])
      expect(
        await searchAddress("x", {
          fetch: (async () => respond()) as unknown as typeof fetch,
        }),
      ).toEqual([]);
  });
});
