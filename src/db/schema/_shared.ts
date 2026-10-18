import { sql } from "drizzle-orm";
import { check, doublePrecision, timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid("id").primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Latitude/longitude columns (WGS84 degrees). `prefix` is the SQL column prefix, e.g. "venue_". */
export const coordinateColumns = (prefix = "") => ({
  latitude: doublePrecision(`${prefix}latitude`).notNull(),
  longitude: doublePrecision(`${prefix}longitude`).notNull(),
});

export const coordinateChecks = (table: string, prefix = "") => [
  check(
    `${table}_${prefix}latitude_range`,
    sql.raw(`${prefix}latitude BETWEEN -90 AND 90`),
  ),
  check(
    `${table}_${prefix}longitude_range`,
    sql.raw(`${prefix}longitude BETWEEN -180 AND 180`),
  ),
];
