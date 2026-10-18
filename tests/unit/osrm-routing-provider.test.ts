import { describe, expect, it, vi } from "vitest";
import { createOsrmRoutingProvider } from "@/modules/routing/infrastructure/osrm-routing-provider";
import { RoutingError } from "@/modules/routing/domain/routing-provider";

const a = { latitude: -12.05, longitude: -77.04 };
const b = { latitude: -12.1, longitude: -77.02 };
const c = { latitude: -12.12, longitude: -77.0 };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const okBody = {
  code: "Ok",
  routes: [
    {
      distance: 9000,
      duration: 900,
      legs: [
        { distance: 5000, duration: 500 },
        { distance: 4000, duration: 400 },
      ],
      geometry: {
        coordinates: [
          [-77.04, -12.05],
          [-77.0, -12.12],
        ],
      },
    },
  ],
};

describe("createOsrmRoutingProvider", () => {
  it("requests lon,lat order and maps legs and geometry", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(okBody));
    const provider = createOsrmRoutingProvider({
      baseUrl: "https://osrm.test/",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const route = await provider.estimateRoute([a, b, c]);

    const url = (fetchMock.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain(
      "/route/v1/driving/-77.04,-12.05;-77.02,-12.1;-77,-12.12?",
    );
    expect(url.startsWith("https://osrm.test/route")).toBe(true);
    expect(route.legs).toEqual([
      { from: a, to: b, distanceMeters: 5000, durationSeconds: 500 },
      { from: b, to: c, distanceMeters: 4000, durationSeconds: 400 },
    ]);
    expect(route.totalDistanceMeters).toBe(9000);
    expect(route.geometry?.[0]).toEqual({
      latitude: -12.05,
      longitude: -77.04,
    });
  });

  it("derives pairwise distance and duration from a two-point route", async () => {
    const body = {
      code: "Ok",
      routes: [
        {
          distance: 1200,
          duration: 130,
          legs: [{ distance: 1200, duration: 130 }],
        },
      ],
    };
    const provider = createOsrmRoutingProvider({
      baseUrl: "https://osrm.test",
      fetch: (async () => jsonResponse(body)) as unknown as typeof fetch,
    });
    expect(await provider.estimateDistance(a, b)).toBe(1200);
    expect(await provider.estimateDuration(a, b)).toBe(130);
  });

  it.each([
    ["NoRoute code", () => jsonResponse({ code: "NoRoute" }, 400)],
    ["malformed body", () => jsonResponse({ nope: true })],
    [
      "leg count mismatch",
      () =>
        jsonResponse({
          ...okBody,
          routes: [{ ...okBody.routes[0], legs: [] }],
        }),
    ],
    ["non-JSON error", () => new Response("bad gateway", { status: 502 })],
  ])("throws RoutingError on %s", async (_name, respond) => {
    const provider = createOsrmRoutingProvider({
      baseUrl: "https://osrm.test",
      fetch: (async () => respond()) as unknown as typeof fetch,
    });
    await expect(provider.estimateRoute([a, b, c])).rejects.toBeInstanceOf(
      RoutingError,
    );
  });

  it("wraps network failures", async () => {
    const provider = createOsrmRoutingProvider({
      baseUrl: "https://osrm.test",
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });
    await expect(provider.estimateRoute([a, b])).rejects.toBeInstanceOf(
      RoutingError,
    );
  });

  it("rejects fewer than two waypoints", async () => {
    const provider = createOsrmRoutingProvider({
      baseUrl: "https://osrm.test",
    });
    await expect(provider.estimateRoute([a])).rejects.toThrow(RangeError);
  });
});

describe("OSRM duration matrix", () => {
  it("preserves directed travel times and unreachable routes", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        code: "Ok",
        durations: [
          [0, 90, null],
          [120, 0, 30],
          [null, 40, 0],
        ],
      }),
    );
    const provider = createOsrmRoutingProvider({
      baseUrl: "https://osrm.test/",
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(await provider.estimateMatrix!([a, b, c])).toEqual({
      durationsSeconds: [
        [0, 90, null],
        [120, 0, 30],
        [null, 40, 0],
      ],
    });
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe(
      "https://osrm.test/table/v1/driving/-77.04,-12.05;-77.02,-12.1;-77,-12.12?annotations=duration",
    );
  });
  it.each([
    { code: "NoTable" },
    { code: "Ok", durations: [[0]] },
    {
      code: "Ok",
      durations: [
        [0, -1],
        [0, 0],
      ],
    },
  ])("rejects unusable tables: %j", async (body) => {
    const provider = createOsrmRoutingProvider({
      baseUrl: "https://osrm.test",
      fetch: (async () => jsonResponse(body)) as typeof fetch,
    });
    await expect(provider.estimateMatrix!([a, b])).rejects.toBeInstanceOf(
      RoutingError,
    );
  });
});
