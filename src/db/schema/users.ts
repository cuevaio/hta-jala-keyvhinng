import { check, integer, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, timestamps } from "./_shared";

export const users = pgTable(
  "users",
  {
    id: id(),
    displayName: text("display_name").notNull(),
    phone: text("phone"),
    /** Denormalised counter used for the "first five rides free" rule. */
    completedRides: integer("completed_rides").notNull().default(0),
    ...timestamps,
  },
  (t) => [check("users_completed_rides_nonneg", sql`${t.completedRides} >= 0`)],
);
