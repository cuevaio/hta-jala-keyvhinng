import { describe, expect, it, vi } from "vitest";
import { createRoomEvents } from "@/modules/notifications/application/room-events";
import type { MatchingOutcome } from "@/modules/matching/infrastructure/matching.repository";
import type { PushMessage } from "@/modules/notifications/domain/push";

const formed = (partyUserIds: string[][]): MatchingOutcome => ({
  createdPartyCount: partyUserIds.length,
  alreadyMatched: false,
  partyUserIds,
});

function setup(outcome: MatchingOutcome | null = null) {
  const matching = { matchInBackground: vi.fn(async () => outcome) };
  const notifications = {
    notify: vi.fn<(userIds: string[], message: PushMessage) => Promise<void>>(
      async () => {},
    ),
  };
  return {
    matching,
    notifications,
    events: createRoomEvents({ matching, notifications }),
    titles: () =>
      notifications.notify.mock.calls.map(([ids, m]) => [ids, m.title]),
  };
}

describe("room events", () => {
  it("matches whoever joined and tells every new member, joiner included", async () => {
    const { matching, events, titles } = setup(formed([["a", "b"]]));
    await events.joined("s", "b");
    expect(matching.matchInBackground).toHaveBeenCalledWith("s", "b");
    expect(titles()).toEqual([[["a", "b"], "Encontramos tu grupo de viaje"]]);
  });

  it("stays quiet when a join forms no group", async () => {
    const { notifications, events } = setup(null);
    await events.joined("s", "a");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("does not notify whoever pressed the match button", async () => {
    const { events, titles } = setup();
    await events.matched("s", "a", formed([["a", "b", "c"]]));
    expect(titles()).toEqual([[["b", "c"], "Encontramos tu grupo de viaje"]]);
  });

  it("tells the others when the last person confirms", async () => {
    const { matching, events, titles } = setup();
    await events.partyChanged("s", {
      kind: "confirmed",
      actorUserId: "c",
      memberUserIds: ["a", "b", "c"],
    });
    expect(titles()).toEqual([[["a", "b"], "Todos confirmaron"]]);
    expect(matching.matchInBackground).not.toHaveBeenCalled();
  });

  it("tells those who stayed that the party dissolved, then re-matches them", async () => {
    const { matching, events, titles } = setup(formed([["a", "b"]]));
    await events.partyChanged("s", {
      kind: "dissolved",
      actorUserId: "leaver",
      memberUserIds: ["leaver", "a", "b"],
    });
    expect(matching.matchInBackground).toHaveBeenCalledWith("s", "a");
    expect(titles()).toEqual([
      [["a", "b"], "Tu grupo de viaje se deshizo"],
      [["a", "b"], "Encontramos tu grupo de viaje"],
    ]);
  });

  it("does nothing for transitions everyone already sees", async () => {
    const { matching, notifications, events } = setup();
    for (const kind of ["started", "completed"] as const)
      await events.partyChanged("s", {
        kind,
        actorUserId: "a",
        memberUserIds: ["a", "b"],
      });
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(matching.matchInBackground).not.toHaveBeenCalled();
  });
});
