import { z } from "zod";
import { SESSION_STATUSES } from "@/modules/sessions/domain/session";

export const sessionIdParams = z.object({ id: z.uuid() });

export const listSessionsQuery = z.object({
  eventId: z.uuid().optional(),
  status: z.enum(SESSION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListSessionsQuery = z.infer<typeof listSessionsQuery>;
