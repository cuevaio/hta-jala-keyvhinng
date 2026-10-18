import { z } from "zod";
import { SESSION_STATUSES } from "@/modules/sessions/domain/session";

export const sessionIdParams = z.object({ id: z.uuid() });

export const listSessionsQuery = z.object({
  eventId: z.uuid().optional(),
  status: z.enum(SESSION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListSessionsQuery = z.infer<typeof listSessionsQuery>;

export const createSessionInput = z.object({ eventId: z.uuid() });

export const joinSessionInput = z.object({
  displayName: z.string().trim().min(1).max(60),
  destinationLabel: z.string().trim().min(3).max(200),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  delegatePreference: z.enum(["delegate", "passenger"]),
});
export type JoinSessionInput = z.infer<typeof joinSessionInput>;
