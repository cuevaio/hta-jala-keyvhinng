import { check, integer, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { WELCOME_CREDIT_MINOR } from "@/modules/payments/domain/fees";
import { id, timestamps } from "./_shared";

export const users = pgTable(
  "users",
  {
    id: id(),
    displayName: text("display_name").notNull(),
    /** Lowercased. Null only for legacy anonymous guests, who cannot sign in. */
    email: text("email").unique(),
    /** `scrypt$…` encoded hash; see modules/auth/domain/password.ts. */
    passwordHash: text("password_hash"),
    phone: text("phone"),
    /** Denormalised count of completed rides. */
    completedRides: integer("completed_rides").notNull().default(0),
    /**
     * Prepaid credit in minor units (céntimos). Debited by the platform fee when a ride
     * completes; fee_ledger_entries is the audit trail. Not constrained to be
     * non-negative: a ride that already happened is always recorded.
     */
    creditBalanceMinor: integer("credit_balance_minor")
      .notNull()
      .default(WELCOME_CREDIT_MINOR),
    ...timestamps,
  },
  (t) => [
    check("users_completed_rides_nonneg", sql`${t.completedRides} >= 0`),
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
    check(
      "users_account_credentials",
      sql`(${t.email} IS NULL) = (${t.passwordHash} IS NULL)`,
    ),
  ],
);
