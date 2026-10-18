import { z } from "zod";
import { EVENT_STATUSES } from "@/modules/events/domain/event";

export const eventIdParams = z.object({ id: z.uuid() });

export const listEventsQuery = z.object({
  status: z.enum(EVENT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListEventsQuery = z.infer<typeof listEventsQuery>;
