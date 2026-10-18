import { createLogMailer, createResendMailer } from "@/lib/mailer";
import { getEnv } from "@/lib/env";
import { createMatchingApplication } from "@/modules/matching/application/matching.service";
import { createMatchingRepository } from "@/modules/matching/infrastructure/matching.repository";
import { createRoadMatchingService } from "@/modules/matching/domain/road-matching";
import { createOsrmRoutingProvider } from "@/modules/routing/infrastructure/osrm-routing-provider";
import { createPartyRepository } from "@/modules/parties/infrastructure/party.repository";
import { createPartyMessageRepository } from "@/modules/parties/infrastructure/party-message.repository";
import { createParticipationRepository } from "@/modules/sessions/infrastructure/participation.repository";
import { getDb } from "@/db";
import { createAuthService } from "@/modules/auth/application/auth.service";
import { createAuthRepository } from "@/modules/auth/infrastructure/auth.repository";
import { createPlaceService } from "@/modules/places/application/place.service";
import { createPlaceRepository } from "@/modules/places/infrastructure/place.repository";
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
    auth: createAuthService(
      createAuthRepository(db),
      getEnv().RESEND_API_KEY
        ? createResendMailer(getEnv().RESEND_API_KEY!, getEnv().MAIL_FROM)
        : createLogMailer(),
      getEnv().NEXT_PUBLIC_APP_URL,
    ),
    participation: createParticipationRepository(db),
    parties: createPartyRepository(db),
    partyMessages: createPartyMessageRepository(db),
    places: createPlaceService(createPlaceRepository(db)),
    sessions: createSessionService(createSessionRepository(db)),
  };
}
