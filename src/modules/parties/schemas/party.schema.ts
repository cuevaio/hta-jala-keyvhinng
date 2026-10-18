import { z } from "zod";
import { PARTY_COMMANDS } from "../domain/party-lifecycle";
import { PARTY_MESSAGE_MAX_LENGTH } from "../domain/party-message";

export const partyCommandBody = z.object({ action: z.enum(PARTY_COMMANDS) });

export const partyMessageBody = z.object({
  body: z.string().trim().min(1).max(PARTY_MESSAGE_MAX_LENGTH),
});

export const partyMessagesQuery = z.object({
  after: z.coerce.number().int().min(0).default(0),
});
