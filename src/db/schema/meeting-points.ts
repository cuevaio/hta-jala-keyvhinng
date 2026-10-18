import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { coordinateChecks, coordinateColumns, id, timestamps } from "./_shared";
import { places } from "./places";

/** Predefined pickup spots at or near a place. */
export const meetingPoints = pgTable(
  "meeting_points",
  {
    id: id(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    ...coordinateColumns(),
    ...timestamps,
  },
  (t) => [
    index("meeting_points_place_idx").on(t.placeId),
    ...coordinateChecks("meeting_points"),
  ],
);
