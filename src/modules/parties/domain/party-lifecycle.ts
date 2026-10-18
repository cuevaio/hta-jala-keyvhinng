import type { MemberStatus, PartyRole, RidePartyStatus } from "./party";

/** Transport-independent command failures; the HTTP adapter translates the status. */
export class PartyError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** The single source of truth for which party status may follow which. */
export const PARTY_TRANSITIONS: Record<
  RidePartyStatus,
  readonly RidePartyStatus[]
> = {
  forming: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

export const PARTY_COMMANDS = [
  "confirm",
  "leave",
  "start",
  "complete",
] as const;
export type PartyCommand = (typeof PARTY_COMMANDS)[number];

export interface PartyState {
  status: RidePartyStatus;
  members: readonly {
    userId: string;
    role: PartyRole;
    status: MemberStatus;
  }[];
}

/** A committed party transition that members who are not looking should hear about. */
export interface PartyEvent {
  kind: "confirmed" | "dissolved" | "started" | "completed";
  actorUserId: string;
  /** Everyone in the party before the command, the actor included. */
  memberUserIds: string[];
}

export type PartyDecision =
  /** Mark the caller confirmed; the party is confirmed once everyone is. */
  | { kind: "confirm"; partyStatus: RidePartyStatus }
  /**
   * Someone left before departure. The route plan and fare shares were computed for
   * this exact membership, so the party is dissolved and the others return to the
   * pool for a fresh match rather than keeping a stale plan.
   */
  | { kind: "dissolve" }
  | { kind: "start" }
  | { kind: "complete" }
  /** The command was already applied; nothing to write. */
  | { kind: "noop" };

function assertTransition(from: RidePartyStatus, to: RidePartyStatus) {
  if (!PARTY_TRANSITIONS[from].includes(to))
    throw new PartyError(
      409,
      "invalid_party_state",
      "Esta acción ya no está disponible para el grupo.",
    );
}

function memberOf(party: PartyState, userId: string) {
  const member = party.members.find((m) => m.userId === userId);
  if (!member)
    throw new PartyError(
      403,
      "membership_required",
      "No eres parte de este grupo de viaje.",
    );
  return member;
}

export function decide(
  party: PartyState,
  userId: string,
  command: PartyCommand,
): PartyDecision {
  const me = memberOf(party, userId);
  switch (command) {
    case "confirm": {
      // Retries are idempotent, including after the whole party has confirmed.
      if (me.status === "confirmed") return { kind: "noop" };
      if (party.status !== "forming")
        throw new PartyError(
          409,
          "invalid_party_state",
          "Esta acción ya no está disponible para el grupo.",
        );
      const everyone = party.members.every(
        (m) => m.userId === userId || m.status === "confirmed",
      );
      return {
        kind: "confirm",
        partyStatus: everyone ? "confirmed" : "forming",
      };
    }
    case "leave": {
      if (party.status === "in_progress")
        throw new PartyError(409, "ride_started", "El viaje ya comenzó.");
      assertTransition(party.status, "cancelled");
      return { kind: "dissolve" };
    }
    case "start":
    case "complete": {
      if (me.role !== "delegate")
        throw new PartyError(
          403,
          "delegate_required",
          "Solo quien reserva el taxi puede hacer esto.",
        );
      assertTransition(
        party.status,
        command === "start" ? "in_progress" : "completed",
      );
      return { kind: command };
    }
  }
}
