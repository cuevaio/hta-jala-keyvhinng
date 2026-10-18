export const RIDE_PARTY_STATUSES = [
  "forming",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type RidePartyStatus = (typeof RIDE_PARTY_STATUSES)[number];

export const PARTY_ROLES = ["delegate", "passenger"] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];

export const MEMBER_STATUSES = [
  "invited",
  "confirmed",
  "verified",
  "dropped_off",
  "no_show",
  "left",
] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const RIDE_STATUSES = [
  "pending",
  "requested",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

export const RIDE_PROVIDERS = ["manual", "uber"] as const;
export type RideProviderName = (typeof RIDE_PROVIDERS)[number];

/** Passengers matched to share a single vehicle. Exactly one member is the delegate. */
export interface RideParty {
  id: string;
  sessionId: string;
  meetingPointId: string | null;
  status: RidePartyStatus;
  members: RidePartyMember[];
}

export interface RidePartyMember {
  id: string;
  partyId: string;
  participantId: string;
  userId: string;
  /** Role actually assigned by matching. */
  role: PartyRole;
  status: MemberStatus;
  /** 1-based position in the drop-off sequence. */
  dropOffOrder: number | null;
  /** Recommended fare share in basis points (10_000 = 100%). */
  fareShareBps: number | null;
}

/** The actual coordinated journey for a ride party. */
export interface Ride {
  id: string;
  partyId: string;
  provider: RideProviderName;
  externalRef: string | null;
  status: RideStatus;
}
