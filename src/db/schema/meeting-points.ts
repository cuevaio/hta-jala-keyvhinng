import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { coordinateChecks, coordinateColumns, id, timestamps } from "./_shared";
import { events } from "./events";

/** Predefined pickup spots near an event venue. */
export const meetingPoints = pgTable(
  "meeting_points",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    ...coordinateColumns(),
    ...timestamps,
  },
  (t) => [
    index("meeting_points_event_idx").on(t.eventId),
    ...coordinateChecks("meeting_points"),
  ],
);
