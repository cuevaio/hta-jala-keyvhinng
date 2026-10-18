import { pgEnum } from "drizzle-orm/pg-core";
import { EVENT_STATUSES } from "@/modules/events/domain/event";
import {
  DELEGATE_PREFERENCES,
  PARTICIPANT_STATUSES,
  SESSION_STATUSES,
} from "@/modules/sessions/domain/session";
import {
  MEMBER_STATUSES,
  PARTY_ROLES,
  RIDE_PARTY_STATUSES,
  RIDE_PROVIDERS,
  RIDE_STATUSES,
} from "@/modules/parties/domain/party";
import { FEE_ENTRY_TYPES } from "@/modules/payments/domain/fees";

// The domain layer owns the allowed values; the database enums mirror them.
export const eventStatus = pgEnum("event_status", EVENT_STATUSES);
export const sessionStatus = pgEnum("session_status", SESSION_STATUSES);
/** What the user *prefers* to be. The assigned role lives on ride_party_members. */
export const delegatePreference = pgEnum(
  "delegate_preference",
  DELEGATE_PREFERENCES,
);
export const participantStatus = pgEnum(
  "participant_status",
  PARTICIPANT_STATUSES,
);
export const ridePartyStatus = pgEnum("ride_party_status", RIDE_PARTY_STATUSES);
/** The role actually assigned within a ride party. */
export const partyRole = pgEnum("party_role", PARTY_ROLES);
export const memberStatus = pgEnum("party_member_status", MEMBER_STATUSES);
export const rideStatus = pgEnum("ride_status", RIDE_STATUSES);
export const rideProvider = pgEnum("ride_provider", RIDE_PROVIDERS);
export const feeEntryType = pgEnum("fee_entry_type", FEE_ENTRY_TYPES);
