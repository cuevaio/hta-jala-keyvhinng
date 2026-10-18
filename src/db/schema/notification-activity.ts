import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { ActivityKind } from "@/modules/notifications/domain/activity";
import { id } from "./_shared";
import { sessions } from "./sessions";
import { users } from "./users";

/** Account activity, committed atomically with each ride transition. */
export const notificationActivity = pgTable(
  "notification_activity",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ActivityKind>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("notification_activity_user_created_idx").on(t.userId, t.createdAt),
  ],
);
