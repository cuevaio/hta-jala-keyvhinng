import { getEnv } from "@/lib/env";
import { createMatchingApplication } from "@/modules/matching/application/matching.service";
import { createMatchingRepository } from "@/modules/matching/infrastructure/matching.repository";
import { createRoadMatchingService } from "@/modules/matching/domain/road-matching";
import { createOsrmRoutingProvider } from "@/modules/routing/infrastructure/osrm-routing-provider";
import { createPartyRepository } from "@/modules/parties/infrastructure/party.repository";
import { createParticipationRepository } from "@/modules/sessions/infrastructure/participation.repository";
import { getDb } from "@/db";
import { createAuthService } from "@/modules/auth/application/auth.service";
import { createAuthRepository } from "@/modules/auth/infrastructure/auth.repository";
import { createEventService } from "@/modules/events/application/event.service";
import { createEventRepository } from "@/modules/events/infrastructure/event.repository";
import { createSessionService } from "@/modules/sessions/application/session.service";
import { createSessionRepository } from "@/modules/sessions/infrastructure/session.repository";

/** Composition root: wires repositories into application services. */
export function getServices() {
  const db = getDb();
  return {
    matching: createMatchingApplication(
      createMatchingRepository(db),
      createRoadMatchingService(
        createOsrmRoutingProvider({ baseUrl: getEnv().ROUTING_BASE_URL }),
      ),
      "osrm",
    ),
    auth: createAuthService(createAuthRepository(db)),
    participation: createParticipationRepository(db),
    parties: createPartyRepository(db),
    events: createEventService(createEventRepository(db)),
    sessions: createSessionService(createSessionRepository(db)),
  };
}
