import { expect, it } from "vitest";
import { parseFareMinor } from "@/modules/payments/domain/fare-input";
it.each([
  ["28.50", 2850],
  ["28,5", 2850],
  ["0", 0],
  [" 45 ", 4500],
  ["99999.99", 9999999],
])("parses %s without losing cents", (value, expected) =>
  expect(parseFareMinor(value)).toBe(expected),
);
it.each(["", "-1", "NaN", "1e3", "28.501", "100000", "S/ 10"])(
  "rejects malformed fare %s",
  (value) => expect(parseFareMinor(value)).toBeNull(),
);
