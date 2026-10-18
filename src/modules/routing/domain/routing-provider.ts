import type { GeoPoint } from "@/modules/events/domain/event";

export interface RouteLeg {
  from: GeoPoint;
  to: GeoPoint;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteEstimate {
  /** One leg per consecutive pair of waypoints. */
  legs: RouteLeg[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  /** Encoded or GeoJSON-style polyline, when the provider supplies it. */
  geometry?: GeoPoint[];
}

/**
 * Provider-agnostic routing contract (OSRM, Google, Mapbox, haversine fallback...).
 * Nothing here may reference a specific mapping vendor.
 */
export interface RoutingMatrix {
  /** Directed road times; null means no road route exists. */
  durationsSeconds: (number | null)[][];
}

export interface RoutingProvider {
  /** Optional batch optimization; order matches the supplied points. */
  estimateMatrix?(points: readonly GeoPoint[]): Promise<RoutingMatrix>;
  /** Travel time in seconds between two coordinates. */
  estimateDuration(from: GeoPoint, to: GeoPoint): Promise<number>;

  /** Distance in meters between two coordinates along the road network. */
  estimateDistance(from: GeoPoint, to: GeoPoint): Promise<number>;

  /**
   * Estimates a route visiting `waypoints` in the given order (at least two).
   * Geometry is optional because not every provider returns it.
   */
  estimateRoute(waypoints: readonly GeoPoint[]): Promise<RouteEstimate>;
}

/** The routing provider could not produce a usable road estimate. */
export class RoutingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RoutingError";
  }
}
