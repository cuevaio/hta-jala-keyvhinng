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
  it("searches Peru in Spanish and returns numeric points", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              display_name: "Av. Larco 345, Miraflores",
              lat: "-12.12",
              lon: "-77.03",
            },
            { display_name: "Broken", lat: "x", lon: "y" },
          ]),
        ),
    );
    const matches = await searchAddress("Av. Larco 345", {
      fetch: fetchMock as unknown as typeof fetch,
    });
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/search");
    expect(url).toContain("countrycodes=pe");
    expect(url).toContain("accept-language=es");
    expect(matches).toEqual([
      {
        label: "Av. Larco 345, Miraflores",
        point: { latitude: -12.12, longitude: -77.03 },
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
