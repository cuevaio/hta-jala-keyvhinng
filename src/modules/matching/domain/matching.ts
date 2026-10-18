import type { GeoPoint } from "@/modules/events/domain/event";
import type { DelegatePreference } from "@/modules/sessions/domain/session";

/** A session participant eligible for matching. */
export interface MatchingCandidate {
  participantId: string;
  userId: string;
  destination: GeoPoint;
  delegatePreference: DelegatePreference;
}

export interface MatchingConstraints {
  /** Maximum people per vehicle, delegate included. */
  vehicleCapacity: number;
  /** Maximum extra travel time any passenger accepts versus a direct trip. */
  maxDetourSeconds: number;
}

export interface CandidatePartyMember {
  participantId: string;
  userId: string;
  role: "delegate" | "passenger";
  /** 1-based drop-off sequence. */
  dropOffOrder: number;
}

/** A proposed grouping, not yet persisted. */
export interface CandidateParty {
  members: CandidatePartyMember[];
}

export interface MatchingResult {
  parties: CandidateParty[];
  /** Participants that could not be placed in any party. */
  unmatched: MatchingCandidate[];
}

/**
 * Groups eligible participants into candidate ride parties.
 *
 * Contract:
 * - Every party has at most `constraints.vehicleCapacity` members.
 * - Every party has exactly one delegate, chosen preferably among participants
 *   who prefer to be delegates. Parties without an available delegate are not produced;
 *   their members go to `unmatched`.
 * - Members of a party must satisfy route compatibility (`maxDetourSeconds`).
 * - Every input candidate appears exactly once, either in a party or in `unmatched`.
 */
export interface MatchingService {
  match(
    candidates: readonly MatchingCandidate[],
    constraints: MatchingConstraints,
  ): Promise<MatchingResult>;
}
