import type { GeoPoint } from "@/modules/places/domain/place";

/** Everyone in a group is picked up within this distance of the group's pickup. */
export const PICKUP_RADIUS_METERS = 1500;
/** A new member's destination must be this close to the group's destination anchor. */
export const DESTINATION_RADIUS_METERS = 3000;
/** Groups leaving further apart than this are not offered to each other. */
export const DEPARTURE_WINDOW_MINUTES = 30;
/**
 * People can still join and match this long after the target departure. Short on
 * purpose: someone leaving a venue will not wait long, and demos stay brisk.
 */
export const JOIN_GRACE_MINUTES = 5;
/**
 * Assigning a rider to a room accepts that room's departure, so it allows less slack
 * than search did: someone leaving as soon as possible is not parked for half an hour.
 */
export const ASSIGN_DEPARTURE_WINDOW_MINUTES = 15;
/** A group stops accepting joins here; matching works through it in rounds of 12. */
export const MAX_GROUP_SIZE = 20;
/** "Leave now" or in N minutes. */
export const DEPARTURE_CHOICES = [0, 15, 30, 60] as const;
export type DepartureChoice = (typeof DEPARTURE_CHOICES)[number];

const EARTH_RADIUS_METERS = 6_371_000;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance. Good to well under 1% at city scale, which is all affinity needs. */
export function haversineMeters(a: GeoPoint, b: GeoPoint) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Latitude/longitude box that contains every point within `meters` of `center`. */
export function boundingBox(center: GeoPoint, meters: number) {
  const dLat = (meters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const cos = Math.max(0.01, Math.cos(toRad(center.latitude)));
  const dLon = dLat / cos;
  return {
    minLat: center.latitude - dLat,
    maxLat: center.latitude + dLat,
    minLon: center.longitude - dLon,
    maxLon: center.longitude + dLon,
  };
}

export interface GroupAnchors {
  pickup: GeoPoint;
  destination: GeoPoint;
  departsAt: Date;
}

export interface RideIntent {
  origin: GeoPoint;
  destination: GeoPoint;
  departsAt: Date;
}

export interface Affinity {
  pickupMeters: number;
  destinationMeters: number;
  departureMinutes: number;
}

/** How far a request is from a group on each axis; null when the group does not fit. */
export function affinityOf(
  group: GroupAnchors,
  intent: RideIntent,
  window = DEPARTURE_WINDOW_MINUTES,
): Affinity | null {
  const pickupMeters = haversineMeters(group.pickup, intent.origin);
  const destinationMeters = haversineMeters(
    group.destination,
    intent.destination,
  );
  const departureMinutes =
    Math.abs(group.departsAt.getTime() - intent.departsAt.getTime()) / 60_000;
  if (
    pickupMeters > PICKUP_RADIUS_METERS ||
    destinationMeters > DESTINATION_RADIUS_METERS ||
    departureMinutes > window
  )
    return null;
  return { pickupMeters, destinationMeters, departureMinutes };
}

/** Lower is a better fit: each axis counts as its share of the allowed slack. */
export function affinityScore(a: Affinity) {
  return (
    a.pickupMeters / PICKUP_RADIUS_METERS +
    a.destinationMeters / DESTINATION_RADIUS_METERS +
    a.departureMinutes / DEPARTURE_WINDOW_MINUTES
  );
}

export function departureFor(choice: DepartureChoice, now = new Date()) {
  return new Date(now.getTime() + choice * 60_000);
}

export function closesAtFor(departsAt: Date) {
  return new Date(departsAt.getTime() + JOIN_GRACE_MINUTES * 60_000);
}
