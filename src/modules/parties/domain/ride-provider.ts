import type { GeoPoint } from "@/modules/places/domain/place";

export interface RideRequest {
  pickup: GeoPoint;
  /** Ordered drop-off stops. */
  stops: GeoPoint[];
  passengerCount: number;
}

export interface RideRequestResult {
  /** Provider-specific trip/booking reference. */
  externalRef: string;
}

/**
 * Adapter boundary for external taxi providers (e.g. Uber).
 *
 * Jala never operates vehicles. In the MVP the delegate books manually, so no
 * implementation is required yet; future integrations implement this interface.
 */
export interface RideProviderAdapter {
  readonly name: string;
  requestRide(request: RideRequest): Promise<RideRequestResult>;
  cancelRide(externalRef: string): Promise<void>;
}
