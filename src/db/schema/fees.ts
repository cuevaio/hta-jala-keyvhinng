import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { feeEntryType } from "./enums";
import { rides } from "./parties";
import { users } from "./users";

/** Append-only record of platform fees and waivers. No real payment processing. */
export const feeLedgerEntries = pgTable(
  "fee_ledger_entries",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rideId: uuid("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    entryType: feeEntryType("entry_type").notNull(),
    /** Amount in minor units (céntimos). PEN 1.00 = 100. Zero for waivers. */
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("PEN"),
    ...timestamps,
  },
  (t) => [
    index("fee_ledger_user_idx").on(t.userId),
    index("fee_ledger_ride_idx").on(t.rideId),
    check("fee_ledger_amount_nonneg", sql`${t.amountMinor} >= 0`),
  ],
);
