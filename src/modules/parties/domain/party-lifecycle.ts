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
  // A new fare after everyone confirmed sends the group back to confirming it.
  confirmed: ["in_progress", "cancelled", "forming"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

export const PARTY_COMMANDS = [
  "confirm",
  "leave",
  "start",
  "complete",
  "set_fare",
] as const;

/** A taxi quote in céntimos: positive and below S/ 1,000. */
export const MAX_FARE_MINOR = 100_000;
export type PartyCommand = (typeof PARTY_COMMANDS)[number];

/** A matched group has this long for everyone to confirm. */
export const CONFIRM_WINDOW_MINUTES = 5;
/** A confirmed group has this long to start the ride. */
export const START_WINDOW_MINUTES = 30;
/**
 * A started ride is never expired (people may really be in the taxi), but after this
 * long any member may close it, so a booker who vanished cannot strand the group.
 */
export const COMPLETE_FALLBACK_MINUTES = 30;

const minutesAfter = (from: Date, minutes: number) =>
  new Date(from.getTime() + minutes * 60_000);
export const confirmDeadline = (matchedAt: Date) =>
  minutesAfter(matchedAt, CONFIRM_WINDOW_MINUTES);
export const startDeadline = (confirmedAt: Date) =>
  minutesAfter(confirmedAt, START_WINDOW_MINUTES);
export const completeFallbackAt = (startedAt: Date) =>
  minutesAfter(startedAt, COMPLETE_FALLBACK_MINUTES);

export type PartyExpiry =
  /** Still within its deadlines (or created before deadlines existed). */
  | "none"
  /** Not everyone confirmed in time: confirmers wait again, the rest are released. */
  | "release_forming"
  /** Confirmed but nobody started: everyone waits again. */
  | "release_confirmed";

export function expiryOf(
  party: {
    status: RidePartyStatus;
    confirmBy: Date | null;
    startBy: Date | null;
  },
  now: Date,
): PartyExpiry {
  if (party.status === "forming" && party.confirmBy && now > party.confirmBy)
    return "release_forming";
  if (party.status === "confirmed" && party.startBy && now > party.startBy)
    return "release_confirmed";
  return "none";
}

export interface PartyState {
  status: RidePartyStatus;
  /** The total the booker posted (céntimos); members confirm against it. */
  fareMinor?: number | null;
  /** When the ride started; lets any member close it after the fallback window. */
  startedAt?: Date | null;
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
  /**
   * The booker posted or changed the total. Everyone must confirm the new amount, so
   * every confirmation is cleared and a confirmed group goes back to forming.
   */
  | { kind: "set_fare"; fareMinor: number }
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
  now: Date = new Date(),
  /** Required for `set_fare`. */
  fareMinor?: number,
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
      // Confirming means agreeing to an amount, so there must be one.
      if (party.fareMinor == null)
        throw new PartyError(
          409,
          "fare_missing",
          "Espera a que quien reserva el taxi publique la tarifa.",
        );
      const everyone = party.members.every(
        (m) => m.userId === userId || m.status === "confirmed",
      );
      return {
        kind: "confirm",
        partyStatus: everyone ? "confirmed" : "forming",
      };
    }
    case "set_fare": {
      if (me.role !== "delegate")
        throw new PartyError(
          403,
          "delegate_required",
          "Solo quien reserva el taxi publica la tarifa.",
        );
      if (party.status !== "forming" && party.status !== "confirmed")
        throw new PartyError(
          409,
          "invalid_party_state",
          "La tarifa ya no se puede cambiar.",
        );
      if (
        fareMinor === undefined ||
        !Number.isInteger(fareMinor) ||
        fareMinor <= 0 ||
        fareMinor >= MAX_FARE_MINOR
      )
        throw new PartyError(
          400,
          "invalid_fare",
          "Ingresa la tarifa total del taxi, mayor que cero.",
        );
      if (fareMinor === party.fareMinor) return { kind: "noop" };
      return { kind: "set_fare", fareMinor };
    }
    case "leave": {
      if (party.status === "in_progress")
        throw new PartyError(409, "ride_started", "El viaje ya comenzó.");
      assertTransition(party.status, "cancelled");
      return { kind: "dissolve" };
    }
    case "start":
    case "complete": {
      const fallback =
        command === "complete" &&
        party.status === "in_progress" &&
        party.startedAt != null &&
        now >= completeFallbackAt(party.startedAt);
      if (me.role !== "delegate" && !fallback)
        throw new PartyError(
          403,
          "delegate_required",
          command === "complete"
            ? `Solo quien reserva el taxi puede terminar el viaje. Si no responde, podrás hacerlo ${COMPLETE_FALLBACK_MINUTES} minutos después del inicio.`
            : "Solo quien reserva el taxi puede hacer esto.",
        );
      assertTransition(
        party.status,
        command === "start" ? "in_progress" : "completed",
      );
      return { kind: command };
    }
  }
}
