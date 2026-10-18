import type { MatchingOutcome } from "@/modules/matching/infrastructure/matching.repository";
import type { PartyEvent } from "@/modules/parties/domain/party-lifecycle";

export interface BackgroundMatcher {
  matchInBackground(
    sessionId: string,
    userId: string,
  ): Promise<MatchingOutcome | null>;
}

/**
 * Side effects of a committed room write. Route handlers schedule these with `after()`,
 * so they never run inside the write's transaction or delay its response, and a failure
 * here never undoes the write.
 */
export function createRoomEvents(deps: { matching: BackgroundMatcher }) {
  return {
    /** Someone entered the room: form a group now if a compatible one exists. */
    async joined(sessionId: string, userId: string) {
      await deps.matching.matchInBackground(sessionId, userId);
    },

    async partyChanged(sessionId: string, event: PartyEvent) {
      if (event.kind !== "dissolved") return;
      // The others are waiting again (ADR 0005); match them without waiting for a tap.
      const [stayed] = event.memberUserIds.filter(
        (id) => id !== event.actorUserId,
      );
      if (stayed) await deps.matching.matchInBackground(sessionId, stayed);
    },
  };
}
export type RoomEvents = ReturnType<typeof createRoomEvents>;
