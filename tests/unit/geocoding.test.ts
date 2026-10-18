import { describe, expect, it, vi } from "vitest";
import { reverseGeocode } from "@/lib/geocoding";

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
