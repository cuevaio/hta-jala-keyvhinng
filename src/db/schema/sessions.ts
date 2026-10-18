import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { coordinateChecks, coordinateColumns, id, timestamps } from "./_shared";
import { delegatePreference, participantStatus, sessionStatus } from "./enums";
import { places } from "./places";
import { users } from "./users";

/**
 * An open ride group: people who start near the same pickup, head the same way and
 * leave around the same time. A place is only an optional pickup anchor.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    placeId: uuid("place_id").references(() => places.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    pickupLabel: text("pickup_label").notNull(),
    pickupLatitude: doublePrecision("pickup_latitude").notNull(),
    pickupLongitude: doublePrecision("pickup_longitude").notNull(),
    /** Where the group is heading; new members must be going somewhere near it. */
    destinationLabel: text("destination_label").notNull(),
    destinationLatitude: doublePrecision("destination_latitude").notNull(),
    destinationLongitude: doublePrecision("destination_longitude").notNull(),
    departsAt: timestamp("departs_at", { withTimezone: true }).notNull(),
    status: sessionStatus("status").notNull().default("open"),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    /** Max passengers per vehicle (delegate included). */
    vehicleCapacity: integer("vehicle_capacity").notNull().default(4),
    /** Bumped by every write a room member can see, so unchanged polls stay cheap. */
    revision: integer("revision").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("sessions_place_status_idx").on(t.placeId, t.status),
    index("sessions_status_departs_idx").on(t.status, t.departsAt),
    index("sessions_pickup_idx").on(t.pickupLatitude, t.pickupLongitude),
    ...coordinateChecks("sessions", "pickup_"),
    ...coordinateChecks("sessions", "destination_"),
    check("sessions_capacity_range", sql`${t.vehicleCapacity} BETWEEN 2 AND 8`),
    check("sessions_closes_after_opens", sql`${t.closesAt} > ${t.opensAt}`),
  ],
);

export const sessionParticipants = pgTable(
  "session_participants",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Private to the participant and their assigned travel group. */
    selfieDataUrl: text("selfie_data_url"),
    /** Where this person is starting from (their GPS or chosen spot). */
    originLabel: text("origin_label").notNull(),
    originLatitude: doublePrecision("origin_latitude").notNull(),
    originLongitude: doublePrecision("origin_longitude").notNull(),
    destinationLabel: text("destination_label").notNull(),
    ...coordinateColumns("destination_"),
    /** Stated preference only; the assigned role is on ride_party_members. */
    delegatePreference: delegatePreference("delegate_preference")
      .notNull()
      .default("passenger"),
    status: participantStatus("status").notNull().default("waiting"),
    ...timestamps,
  },
  (t) => [
    unique("session_participants_session_user_uq").on(t.sessionId, t.userId),
    index("session_participants_session_status_idx").on(t.sessionId, t.status),
    index("session_participants_user_idx").on(t.userId),
    ...coordinateChecks("session_participants", "destination_"),
    ...coordinateChecks("session_participants", "origin_"),
  ],
);
