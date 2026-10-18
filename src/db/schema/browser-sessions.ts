import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Only a hash is persisted; the random bearer token stays in an HttpOnly cookie. */
export const browserSessions = pgTable(
  "browser_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("browser_sessions_user_idx").on(t.userId),
    index("browser_sessions_expires_idx").on(t.expiresAt),
  ],
);
