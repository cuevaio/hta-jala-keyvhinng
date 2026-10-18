import { z } from "zod";
import type { GeoPoint } from "@/modules/places/domain/place";
import {
  RoutingError,
  type RouteEstimate,
  type RoutingProvider,
} from "@/modules/routing/domain/routing-provider";

const DEFAULT_TIMEOUT_MS = 5_000;

const osrmResponseSchema = z.object({
  code: z.string(),
  routes: z
    .array(
      z.object({
        distance: z.number().finite().nonnegative(),
        duration: z.number().finite().nonnegative(),
        legs: z.array(
          z.object({
            distance: z.number().finite().nonnegative(),
            duration: z.number().finite().nonnegative(),
          }),
        ),
        geometry: z
          .object({ coordinates: z.array(z.tuple([z.number(), z.number()])) })
          .optional(),
      }),
    )
    .optional(),
});

export interface OsrmRoutingOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

/** RoutingProvider backed by an OSRM-compatible `/route/v1/driving` endpoint. */
export function createOsrmRoutingProvider(
  options: OsrmRoutingOptions,
): RoutingProvider {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = options.fetch ?? fetch;

  async function estimateRoute(
    waypoints: readonly GeoPoint[],
  ): Promise<RouteEstimate> {
    if (waypoints.length < 2) {
      throw new RangeError("A route needs at least two waypoints");
    }
    // OSRM expects longitude,latitude order.
    const coordinates = waypoints
      .map((p) => `${p.longitude},${p.latitude}`)
      .join(";");
    const url = `${baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;

    let body: unknown;
    try {
      const response = await doFetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      // OSRM reports routing failures (NoRoute...) as 4xx with a JSON body.
      body = await response.json();
      if (!response.ok && !(body as { code?: string })?.code) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (cause) {
      throw new RoutingError("Routing request failed", { cause });
    }

    const parsed = osrmResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new RoutingError("Unexpected routing response shape", {
        cause: parsed.error,
      });
    }
    const route = parsed.data.routes?.[0];
    if (parsed.data.code !== "Ok" || !route) {
      throw new RoutingError(`No route found (${parsed.data.code})`);
    }
    if (route.legs.length !== waypoints.length - 1) {
      throw new RoutingError("Routing response leg count mismatch");
    }

    return {
      legs: route.legs.map((leg, i) => ({
        from: waypoints[i],
        to: waypoints[i + 1],
        distanceMeters: leg.distance,
        durationSeconds: leg.duration,
      })),
      totalDistanceMeters: route.distance,
      totalDurationSeconds: route.duration,
      geometry: route.geometry?.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      })),
    };
  }

  return {
    async estimateMatrix(points) {
      const coordinates = points
        .map((p) => `${p.longitude},${p.latitude}`)
        .join(";");
      try {
        const response = await doFetch(
          `${baseUrl}/table/v1/driving/${coordinates}?annotations=duration`,
          {
            signal: AbortSignal.timeout(timeoutMs),
          },
        );
        const parsed = z
          .object({
            code: z.literal("Ok"),
            durations: z.array(
              z.array(z.number().finite().nonnegative().nullable()),
            ),
          })
          .safeParse(await response.json());
        if (
          !response.ok ||
          !parsed.success ||
          parsed.data.durations.length !== points.length ||
          parsed.data.durations.some((row) => row.length !== points.length)
        ) {
          throw new Error("Invalid OSRM table response");
        }
        return { durationsSeconds: parsed.data.durations };
      } catch (cause) {
        throw new RoutingError("Routing matrix request failed", { cause });
      }
    },
    estimateRoute,
    async estimateDistance(from, to) {
      return (await estimateRoute([from, to])).totalDistanceMeters;
    },
    async estimateDuration(from, to) {
      return (await estimateRoute([from, to])).totalDurationSeconds;
    },
  };
}
