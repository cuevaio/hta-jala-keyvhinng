import { sql } from "drizzle-orm";
import {
  check,
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

/** A temporary matching pool of people leaving a place in one departure window. */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: sessionStatus("status").notNull().default("open"),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    /** Max passengers per vehicle (delegate included). */
    vehicleCapacity: integer("vehicle_capacity").notNull().default(4),
    ...timestamps,
  },
  (t) => [
    index("sessions_place_status_idx").on(t.placeId, t.status),
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
  ],
);
