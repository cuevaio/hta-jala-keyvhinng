import type { EventRepository } from "@/modules/events/infrastructure/event.repository";
import type { ListEventsQuery } from "@/modules/events/schemas/event.schema";
import { NotFoundError } from "@/lib/errors";

export function createEventService(repo: EventRepository) {
  return {
    list: (query: ListEventsQuery) => repo.list(query),
    async getById(id: string) {
      const event = await repo.findById(id);
      if (!event) throw new NotFoundError("Event");
      return event;
    },
  };
}
export type EventService = ReturnType<typeof createEventService>;
