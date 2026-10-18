import { z } from "zod";
import { PARTY_COMMANDS } from "../domain/party-lifecycle";

export const partyCommandBody = z.object({ action: z.enum(PARTY_COMMANDS) });
