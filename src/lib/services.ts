import { createParticipationRepository } from "@/modules/sessions/infrastructure/participation.repository";
import { getDb } from "@/db";
import { createEventService } from "@/modules/events/application/event.service";
import { createEventRepository } from "@/modules/events/infrastructure/event.repository";
import { createSessionService } from "@/modules/sessions/application/session.service";
import { createSessionRepository } from "@/modules/sessions/infrastructure/session.repository";

/** Composition root: wires repositories into application services. */
export function getServices() {
  const db = getDb();
  return {
    participation: createParticipationRepository(db),
    events: createEventService(createEventRepository(db)),
    sessions: createSessionService(createSessionRepository(db)),
  };
}
