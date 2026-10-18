import { relations } from "drizzle-orm";
import { places } from "./places";
import { feeLedgerEntries } from "./fees";
import { meetingPoints } from "./meeting-points";
import { rideParties, ridePartyMembers, rides } from "./parties";
import { sessionParticipants, sessions } from "./sessions";
import { users } from "./users";

export const placesRelations = relations(places, ({ many }) => ({
  sessions: many(sessions),
  meetingPoints: many(meetingPoints),
}));

export const meetingPointsRelations = relations(meetingPoints, ({ one }) => ({
  place: one(places, {
    fields: [meetingPoints.placeId],
    references: [places.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  place: one(places, { fields: [sessions.placeId], references: [places.id] }),
  participants: many(sessionParticipants),
  parties: many(rideParties),
}));

export const sessionParticipantsRelations = relations(
  sessionParticipants,
  ({ one }) => ({
    session: one(sessions, {
      fields: [sessionParticipants.sessionId],
      references: [sessions.id],
    }),
    user: one(users, {
      fields: [sessionParticipants.userId],
      references: [users.id],
    }),
  }),
);

export const ridePartiesRelations = relations(rideParties, ({ one, many }) => ({
  session: one(sessions, {
    fields: [rideParties.sessionId],
    references: [sessions.id],
  }),
  meetingPoint: one(meetingPoints, {
    fields: [rideParties.meetingPointId],
    references: [meetingPoints.id],
  }),
  members: many(ridePartyMembers),
  ride: one(rides),
}));

export const ridePartyMembersRelations = relations(
  ridePartyMembers,
  ({ one }) => ({
    party: one(rideParties, {
      fields: [ridePartyMembers.partyId],
      references: [rideParties.id],
    }),
    participant: one(sessionParticipants, {
      fields: [ridePartyMembers.participantId],
      references: [sessionParticipants.id],
    }),
    user: one(users, {
      fields: [ridePartyMembers.userId],
      references: [users.id],
    }),
  }),
);

export const ridesRelations = relations(rides, ({ one, many }) => ({
  party: one(rideParties, {
    fields: [rides.partyId],
    references: [rideParties.id],
  }),
  feeEntries: many(feeLedgerEntries),
}));

export const feeLedgerEntriesRelations = relations(
  feeLedgerEntries,
  ({ one }) => ({
    user: one(users, {
      fields: [feeLedgerEntries.userId],
      references: [users.id],
    }),
    ride: one(rides, {
      fields: [feeLedgerEntries.rideId],
      references: [rides.id],
    }),
  }),
);
