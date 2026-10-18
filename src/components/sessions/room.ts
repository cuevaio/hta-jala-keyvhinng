import type { MatchingRoutePlan } from "@/modules/matching/domain/route-plan";

export type PartyStatus =
  "forming" | "confirmed" | "in_progress" | "completed" | "cancelled";

/** JSON shape of GET /api/sessions/:id/waiting-room, as the client consumes it. */
export interface Room {
  /** Changes whenever anything a member can see changes, including chat. */
  revision: number;
  serverNow: string;
  party: {
    id: string;
    status: PartyStatus;
    plan: MatchingRoutePlan | null;
    members: {
      participantId: string;
      status: string;
      /** Private, versioned photo URL; null when the member has no photo. */
      selfieUrl: string | null;
    }[];
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

/** A poll that sent the current revision: only the server clock is fresh. */
export interface RoomUnchanged {
  unchanged: true;
  revision: number;
  serverNow: string;
}
