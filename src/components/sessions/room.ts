import type { MatchingRoutePlan } from "@/modules/matching/domain/route-plan";

export type PartyStatus =
  "forming" | "confirmed" | "in_progress" | "completed" | "cancelled";

/** JSON shape of GET /api/sessions/:id/waiting-room, as the client consumes it. */
export interface Room {
  party: {
    id: string;
    status: PartyStatus;
    plan: MatchingRoutePlan | null;
    members: { participantId: string; status: string }[];
  } | null;
  me: {
    id: string;
    destinationLabel: string;
    latitude: number;
    longitude: number;
    delegatePreference: "delegate" | "passenger";
  };
  participants: {
    id: string;
    displayName: string;
    delegatePreference: "delegate" | "passenger";
    status: string;
  }[];
  acceptingJoins: boolean;
}
