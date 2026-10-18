import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { coordinateChecks, coordinateColumns, id, timestamps } from "./_shared";
import { eventStatus } from "./enums";

export const events = pgTable(
  "events",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    venueName: text("venue_name").notNull(),
    venueLatitude: coordinateColumns("venue_").latitude,
    venueLongitude: coordinateColumns("venue_").longitude,
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: eventStatus("status").notNull().default("scheduled"),
    /** True for seed/demo data so it's never confused with real events. */
    isFictional: boolean("is_fictional").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("events_slug_uq").on(t.slug),
    index("events_status_starts_at_idx").on(t.status, t.startsAt),
    check("events_ends_after_starts", sql`${t.endsAt} > ${t.startsAt}`),
    ...coordinateChecks("events", "venue_"),
  ],
);
