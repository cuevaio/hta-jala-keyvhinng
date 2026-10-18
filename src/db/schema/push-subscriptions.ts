import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { users } from "./users";

/** One browser that agreed to receive Web Push for an account; a person may have several. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Push service URL; the browser's capability to wake this device. */
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    ...timestamps,
  },
  (t) => [
    unique("push_subscriptions_endpoint_uq").on(t.endpoint),
    index("push_subscriptions_user_idx").on(t.userId),
  ],
);
