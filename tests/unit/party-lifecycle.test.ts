import { describe, expect, it } from "vitest";
import {
  decide,
  PARTY_TRANSITIONS,
  PartyError,
  type PartyState,
  confirmDeadline,
  expiryOf,
  startDeadline,
} from "@/modules/parties/domain/party-lifecycle";
import { apportionMinor } from "@/modules/payments/domain/fare-allocation";

const party = (
  status: PartyState["status"],
  statuses: PartyState["members"][number]["status"][] = ["invited", "invited"],
): PartyState => ({
  status,
  members: statuses.map((s, i) => ({
    userId: `u${i}`,
    role: i === 0 ? "delegate" : "passenger",
    status: s,
  })),
});
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof PartyError ? e.code : "other";
  }
  return "none";
};

describe("party lifecycle decisions", () => {
  it("only confirms the party once every member has confirmed", () => {
    expect(decide(party("forming"), "u1", "confirm")).toEqual({
      kind: "confirm",
      partyStatus: "forming",
    });
    expect(
      decide(party("forming", ["confirmed", "invited"]), "u1", "confirm"),
    ).toEqual({ kind: "confirm", partyStatus: "confirmed" });
  });

  it("treats a repeated confirmation as a no-op, even after departure was confirmed", () => {
    expect(
      decide(party("confirmed", ["confirmed", "confirmed"]), "u0", "confirm"),
    ).toEqual({ kind: "noop" });
  });

  it("dissolves the party when anyone leaves before departure", () => {
    expect(decide(party("forming"), "u1", "leave")).toEqual({
      kind: "dissolve",
    });
    expect(decide(party("confirmed"), "u0", "leave")).toEqual({
      kind: "dissolve",
    });
  });

  it("refuses to leave or confirm once the ride has started or ended", () => {
    expect(code(() => decide(party("in_progress"), "u1", "leave"))).toBe(
      "ride_started",
    );
    expect(code(() => decide(party("completed"), "u1", "leave"))).toBe(
      "invalid_party_state",
    );
    expect(code(() => decide(party("in_progress"), "u1", "confirm"))).toBe(
      "invalid_party_state",
    );
  });

  it("lets only the delegate start and complete, in order", () => {
    expect(code(() => decide(party("confirmed"), "u1", "start"))).toBe(
      "delegate_required",
    );
    expect(code(() => decide(party("forming"), "u0", "start"))).toBe(
      "invalid_party_state",
    );
    expect(decide(party("confirmed"), "u0", "start")).toEqual({
      kind: "start",
    });
    expect(code(() => decide(party("confirmed"), "u0", "complete"))).toBe(
      "invalid_party_state",
    );
    expect(decide(party("in_progress"), "u0", "complete")).toEqual({
      kind: "complete",
    });
  });

  it("rejects non-members", () => {
    expect(code(() => decide(party("forming"), "stranger", "confirm"))).toBe(
      "membership_required",
    );
  });

  it("has terminal completed and cancelled states", () => {
    expect(PARTY_TRANSITIONS.completed).toEqual([]);
    expect(PARTY_TRANSITIONS.cancelled).toEqual([]);
  });
});

describe("apportionMinor", () => {
  it("always sums exactly to the fare", () => {
    for (const total of [0, 1, 999, 6000, 12345])
      for (const bps of [[10000], [5000, 5000], [3334, 3333, 3333], [1, 9999]])
        expect(apportionMinor(total, bps).reduce((a, b) => a + b, 0)).toBe(
          total,
        );
  });
  it("gives the extra céntimo to the largest remainder", () => {
    expect(apportionMinor(1000, [3334, 3333, 3333])).toEqual([334, 333, 333]);
  });
  it("rejects invalid input", () => {
    expect(() => apportionMinor(1.5, [10000])).toThrow(RangeError);
    expect(() => apportionMinor(100, [5000])).toThrow(RangeError);
  });
});

describe("deadlines", () => {
  const t0 = new Date("2026-10-18T12:00:00Z");
  const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

  it("releases a forming group nobody finished confirming", () => {
    const party = {
      status: "forming" as const,
      confirmBy: confirmDeadline(t0),
      startBy: null,
    };
    expect(expiryOf(party, at(4))).toBe("none");
    expect(expiryOf(party, at(6))).toBe("release_forming");
  });

  it("releases a confirmed group nobody started", () => {
    const party = {
      status: "confirmed" as const,
      confirmBy: null,
      startBy: startDeadline(t0),
    };
    expect(expiryOf(party, at(29))).toBe("none");
    expect(expiryOf(party, at(31))).toBe("release_confirmed");
  });

  it("never expires a ride in progress or a group without deadlines", () => {
    expect(
      expiryOf(
        { status: "in_progress", confirmBy: at(-60), startBy: at(-60) },
        at(600),
      ),
    ).toBe("none");
    expect(
      expiryOf({ status: "forming", confirmBy: null, startBy: null }, at(600)),
    ).toBe("none");
  });

  it("lets a passenger close a started ride only after the fallback window", () => {
    const party = {
      status: "in_progress" as const,
      startedAt: t0,
      members: [
        {
          userId: "booker",
          role: "delegate" as const,
          status: "confirmed" as const,
        },
        {
          userId: "rider",
          role: "passenger" as const,
          status: "confirmed" as const,
        },
      ],
    };
    expect(() => decide(party, "rider", "complete", at(10))).toThrow(
      expect.objectContaining({ code: "delegate_required" }),
    );
    expect(decide(party, "rider", "complete", at(31))).toEqual({
      kind: "complete",
    });
    // Starting stays with the booker: they are the one who ordered the taxi.
    expect(() =>
      decide({ ...party, status: "confirmed" }, "rider", "start", at(31)),
    ).toThrow(expect.objectContaining({ code: "delegate_required" }));
  });
});
