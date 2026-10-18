export const EVENT_STATUSES = [
  "scheduled",
  "active",
  "ended",
  "cancelled",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** A concert, theater performance or similar gathering. */
export interface Event {
  id: string;
  slug: string;
  name: string;
  description: string;
  venueName: string;
  venue: GeoPoint;
  startsAt: Date;
  endsAt: Date;
  status: EventStatus;
  /** True for seed/demo data. */
  isFictional: boolean;
}

/** A predefined pickup spot near an event venue. */
export interface MeetingPoint {
  id: string;
  eventId: string;
  name: string;
  description: string;
  location: GeoPoint;
}

export type EventWithMeetingPoints = Event & { meetingPoints: MeetingPoint[] };
