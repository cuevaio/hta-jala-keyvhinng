import type { RidePartyStatus } from "./party";

export const PARTY_MESSAGE_MAX_LENGTH = 500;
/** Newest messages returned per read; a ride group of three never gets near it between polls. */
export const PARTY_MESSAGE_PAGE = 100;

/** One-tap replies for the moments a ride group usually needs to coordinate. */
export const QUICK_MESSAGES = [
  "Ya llegué al punto de encuentro.",
  "Voy en camino, llego en 5 minutos.",
  "¿Dónde están?",
  "Ya pedí el taxi.",
] as const;

/** A message in a ride group's chat, as members see it. */
export interface PartyMessage {
  /** Monotonic within a party; clients poll with the last one they saw. */
  seq: number;
  participantId: string;
  displayName: string;
  body: string;
  createdAt: Date;
}

/**
 * Members can write while the ride is being arranged or under way. A finished ride keeps
 * its history readable; a cancelled party has no members left to read it.
 */
export function canPostMessages(status: RidePartyStatus) {
  return (
    status === "forming" || status === "confirmed" || status === "in_progress"
  );
}
