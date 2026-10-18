import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { coordinateChecks, coordinateColumns, id, timestamps } from "./_shared";
import { placeKind, placeStatus } from "./enums";

/** A common place people leave together: venue, university, mall, station… */
export const places = pgTable(
  "places",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: placeKind("kind").notNull().default("other"),
    description: text("description").notNull().default(""),
    address: text("address").notNull().default(""),
    ...coordinateColumns(),
    status: placeStatus("status").notNull().default("active"),
    /** True for seed/demo data so it's never confused with real places. */
    isFictional: boolean("is_fictional").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("places_slug_uq").on(t.slug),
    index("places_status_kind_idx").on(t.status, t.kind),
    ...coordinateChecks("places"),
  ],
);
