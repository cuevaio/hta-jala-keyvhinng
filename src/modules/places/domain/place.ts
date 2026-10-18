export const PLACE_STATUSES = ["active", "inactive"] as const;
export type PlaceStatus = (typeof PLACE_STATUSES)[number];

/** What kind of common place people leave. Drives wording and icons, not behavior. */
export const PLACE_KINDS = [
  "venue",
  "university",
  "mall",
  "transit",
  "other",
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  venue: "Conciertos y teatro",
  university: "Universidad",
  mall: "Centro comercial",
  transit: "Transporte",
  other: "Otro lugar",
};

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * A common place people leave at the same time: a venue, university, mall or station.
 * It has no schedule of its own; departure rooms (sessions) carry the time window.
 */
export interface Place {
  id: string;
  slug: string;
  name: string;
  kind: PlaceKind;
  description: string;
  address: string;
  location: GeoPoint;
  status: PlaceStatus;
  /** True for seed/demo data. */
  isFictional: boolean;
}

/** A predefined pickup spot at or near a place. */
export interface MeetingPoint {
  id: string;
  placeId: string;
  name: string;
  description: string;
  location: GeoPoint;
}

export type PlaceWithMeetingPoints = Place & { meetingPoints: MeetingPoint[] };
