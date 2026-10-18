import { selfieDataUrl } from "../fixtures/selfie";
import { describe, expect, it } from "vitest";
import { joinSessionInput } from "@/modules/sessions/schemas/session.schema";
import { assertSameOrigin, readJson } from "@/lib/http";

const input = {
  selfieDataUrl,
  displayName: " Ana ",
  originLabel: "Mi ubicación",
  originLatitude: -12.1,
  originLongitude: -77.04,
  destinationLabel: "Mi destino",
  latitude: -12.12,
  longitude: -77.03,
  delegatePreference: "delegate",
};
describe("join input and request boundary", () => {
  it("normalizes names and preserves exact coordinates", () => {
    expect(joinSessionInput.parse(input)).toEqual({
      ...input,
      displayName: "Ana",
    });
  });
  it("accepts a join without a name: rooms use the account's", () => {
    expect(
      joinSessionInput.parse({ ...input, displayName: undefined }).displayName,
    ).toBeUndefined();
  });
  it.each([
    { selfieDataUrl: undefined },
    { selfieDataUrl: "" },
    { selfieDataUrl: "https://example.com/photo.jpg" },
    { selfieDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" },
    { selfieDataUrl: "data:image/jpeg;base64,aGVsbG8=" },
    { selfieDataUrl: "data:image/jpeg;base64," + "A".repeat(200004) },
    { displayName: " " },
    { latitude: 91 },
    { longitude: -181 },
    { latitude: "" },
    { delegatePreference: "auto" },
    { destinationLabel: "" },
    { originLabel: "" },
    { originLatitude: 91 },
    { originLongitude: "" },
  ])("rejects invalid input: %j", (override) => {
    expect(joinSessionInput.safeParse({ ...input, ...override }).success).toBe(
      false,
    );
  });
  it("rejects cross-origin mutations", () => {
    expect(() =>
      assertSameOrigin(
        new Request("https://jala.test/api/sessions", {
          headers: { origin: "https://other.test" },
        }),
      ),
    ).toThrow();
  });
  it("returns a client error for malformed JSON", async () => {
    await expect(
      readJson(
        new Request("https://jala.test", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
