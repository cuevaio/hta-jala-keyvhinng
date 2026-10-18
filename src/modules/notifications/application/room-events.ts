import type { MatchingOutcome } from "@/modules/matching/infrastructure/matching.repository";
import type { PartyEvent } from "@/modules/parties/domain/party-lifecycle";
import { roomMessages, type PushMessage } from "../domain/push";

export interface BackgroundMatcher {
  matchInBackground(
    sessionId: string,
    userId: string,
  ): Promise<MatchingOutcome | null>;
}

export interface Notifier {
  notify(userIds: string[], message: PushMessage): Promise<void>;
}

/**
 * Side effects of a committed room write. Route handlers schedule these with `after()`,
 * so they never run inside the write's transaction or delay its response, and a failure
 * here never undoes the write.
 */
export function createRoomEvents(deps: {
  matching: BackgroundMatcher;
  notifications: Notifier;
}) {
  const partiesFormed = (
    sessionId: string,
    partyUserIds: string[][],
    exceptUserId?: string,
  ) =>
    deps.notifications.notify(
      partyUserIds.flat().filter((id) => id !== exceptUserId),
      roomMessages.partyFormed(sessionId),
    );

  return {
    /**
     * Someone pressed the match button. They see the result on screen, so only the
     * others are notified.
     */
    async matched(sessionId: string, userId: string, outcome: MatchingOutcome) {
      await partiesFormed(sessionId, outcome.partyUserIds, userId);
    },

    /** Someone entered the room: form a group now if a compatible one exists. */
    async joined(sessionId: string, userId: string) {
      const outcome = await deps.matching.matchInBackground(sessionId, userId);
      // Everyone, the joiner included: they may have put the phone away already.
      if (outcome) await partiesFormed(sessionId, outcome.partyUserIds);
    },

    async partyChanged(sessionId: string, event: PartyEvent) {
      // The actor is looking at the result; tell the people who are not.
      const others = event.memberUserIds.filter(
        (id) => id !== event.actorUserId,
      );
      if (event.kind === "confirmed")
        await deps.notifications.notify(
          others,
          roomMessages.partyConfirmed(sessionId),
        );
      if (event.kind !== "dissolved" || !others.length) return;
      await deps.notifications.notify(
        others,
        roomMessages.partyDissolved(sessionId),
      );
      // The others are waiting again (ADR 0005); match them without waiting for a tap.
      const outcome = await deps.matching.matchInBackground(
        sessionId,
        others[0],
      );
      if (outcome) await partiesFormed(sessionId, outcome.partyUserIds);
    },
  };
}
export type RoomEvents = ReturnType<typeof createRoomEvents>;
