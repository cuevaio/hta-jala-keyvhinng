import type { MatchingRoutePlan } from "@/modules/matching/domain/route-plan";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import {
  memberStatus,
  partyRole,
  ridePartyStatus,
  rideProvider,
  rideStatus,
} from "./enums";
import { meetingPoints } from "./meeting-points";
import { sessionParticipants, sessions } from "./sessions";
import { users } from "./users";

/** Passengers matched to share one vehicle. */
export const rideParties = pgTable(
  "ride_parties",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    meetingPointId: uuid("meeting_point_id").references(
      () => meetingPoints.id,
      {
        onDelete: "set null",
      },
    ),
    routePlan: jsonb("route_plan").$type<MatchingRoutePlan>(),
    status: ridePartyStatus("status").notNull().default("forming"),
    /** Everyone must confirm by then; null (older rows) never expires. */
    confirmBy: timestamp("confirm_by", { withTimezone: true }),
    /** Set on confirmation: the ride must start by then. */
    startBy: timestamp("start_by", { withTimezone: true }),
    /** Taxi quote the booker posted, in céntimos; members confirm against it. */
    fareMinor: integer("fare_minor"),
    ...timestamps,
  },
  (t) => [
    index("ride_parties_session_status_idx").on(t.sessionId, t.status),
    index("ride_parties_meeting_point_idx").on(t.meetingPointId),
    check(
      "ride_parties_fare_range",
      sql`${t.fareMinor} IS NULL OR ${t.fareMinor} BETWEEN 1 AND 99999`,
    ),
  ],
);

export const ridePartyMembers = pgTable(
  "ride_party_members",
  {
    id: id(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => rideParties.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => sessionParticipants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Role actually assigned by matching (distinct from stated preference). */
    role: partyRole("role").notNull().default("passenger"),
    status: memberStatus("status").notNull().default("invited"),
    /** 1-based position in the recommended drop-off sequence. */
    dropOffOrder: integer("drop_off_order"),
    /** Recommended fare share in basis points (10_000 = 100%). */
    fareShareBps: integer("fare_share_bps"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("ride_party_members_party_user_uq").on(t.partyId, t.userId),
    unique("ride_party_members_participant_uq").on(t.participantId),
    // Exactly one delegate per party.
    uniqueIndex("ride_party_members_one_delegate_uq")
      .on(t.partyId)
      .where(sql`${t.role} = 'delegate'`),
    index("ride_party_members_user_idx").on(t.userId),
    check(
      "ride_party_members_fare_bps_range",
      sql`${t.fareShareBps} IS NULL OR ${t.fareShareBps} BETWEEN 0 AND 10000`,
    ),
    check(
      "ride_party_members_drop_off_positive",
      sql`${t.dropOffOrder} IS NULL OR ${t.dropOffOrder} >= 1`,
    ),
  ],
);

/** The actual coordinated journey for a ride party. */
export const rides = pgTable(
  "rides",
  {
    id: id(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => rideParties.id, { onDelete: "cascade" }),
    provider: rideProvider("provider").notNull().default("manual"),
    /** Opaque reference in the external provider (e.g. trip id). */
    externalRef: text("external_ref"),
    status: rideStatus("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("rides_party_uq").on(t.partyId),
    index("rides_status_idx").on(t.status),
  ],
);

/** Chat between the members of one ride party, so they can find each other and coordinate. */
export const partyMessages = pgTable(
  "party_messages",
  {
    id: id(),
    /** Read cursor; inserts lock the party row, so a party's messages commit in this order. */
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => rideParties.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => sessionParticipants.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("party_messages_seq_uq").on(t.seq),
    index("party_messages_party_seq_idx").on(t.partyId, t.seq),
    check(
      "party_messages_body_length",
      sql`char_length(${t.body}) BETWEEN 1 AND 500`,
    ),
  ],
);
