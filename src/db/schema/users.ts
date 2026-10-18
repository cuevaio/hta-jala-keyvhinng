import { check, integer, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
    /** Denormalised counter used for the "first five rides free" rule. */
    completedRides: integer("completed_rides").notNull().default(0),
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
