import { describe, expect, it } from "vitest";
import {
  canPostMessages,
  PARTY_MESSAGE_MAX_LENGTH,
} from "@/modules/parties/domain/party-message";
import {
  partyMessageBody,
  partyMessagesQuery,
} from "@/modules/parties/schemas/party.schema";

describe("party chat rules", () => {
  it("allows posting only while the ride is arranged or under way", () => {
    expect(canPostMessages("forming")).toBe(true);
    expect(canPostMessages("confirmed")).toBe(true);
    expect(canPostMessages("in_progress")).toBe(true);
    expect(canPostMessages("completed")).toBe(false);
    expect(canPostMessages("cancelled")).toBe(false);
  });

  it("trims bodies and rejects empty or oversized ones", () => {
    expect(partyMessageBody.parse({ body: "  Ya llegué  " }).body).toBe(
      "Ya llegué",
    );
    expect(partyMessageBody.safeParse({ body: "   " }).success).toBe(false);
    expect(
      partyMessageBody.safeParse({
        body: "a".repeat(PARTY_MESSAGE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("reads the poll cursor from the query string", () => {
    expect(partyMessagesQuery.parse({}).after).toBe(0);
    expect(partyMessagesQuery.parse({ after: "42" }).after).toBe(42);
    expect(partyMessagesQuery.safeParse({ after: "-1" }).success).toBe(false);
    expect(partyMessagesQuery.safeParse({ after: "abc" }).success).toBe(false);
  });
});
