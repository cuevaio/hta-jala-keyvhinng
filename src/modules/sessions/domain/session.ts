import type { GeoPoint } from "@/modules/places/domain/place";

export const SESSION_STATUSES = [
  "open",
  "matching",
  "matched",
  "closed",
  "cancelled",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** What a user prefers to be. The role actually assigned lives on the ride party member. */
export const DELEGATE_PREFERENCES = ["delegate", "passenger"] as const;
export type DelegatePreference = (typeof DELEGATE_PREFERENCES)[number];

export const PARTICIPANT_STATUSES = [
  "waiting",
  "matched",
  "withdrawn",
] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

/** A pool ("sala de espera" in the UI): nearby people heading the same way around the same time. */
export interface Session {
  id: string;
  /** Set when the pickup was snapped to a known place. */
  placeId: string | null;
  name: string;
  pickupLabel: string;
  pickup: GeoPoint;
  destinationLabel: string;
  destination: GeoPoint;
  departsAt: Date;
  status: SessionStatus;
  opensAt: Date;
  closesAt: Date;
  /** Maximum people per vehicle, delegate included. */
  vehicleCapacity: number;
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  userId: string;
  originLabel: string;
  origin: GeoPoint;
  destinationLabel: string;
  destination: GeoPoint;
  delegatePreference: DelegatePreference;
  status: ParticipantStatus;
}

export interface SessionSummary extends Session {
  participantCount: number;
}
