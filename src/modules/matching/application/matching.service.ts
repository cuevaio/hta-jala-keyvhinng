import type { MatchingService } from "../domain/matching";
import type { MatchingRoutePlan } from "../domain/route-plan";
import { MAX_DETOUR_SECONDS } from "../domain/road-matching";
import type { MatchingRepository } from "../infrastructure/matching.repository";
import { allocateBySegmentDistance } from "@/modules/payments/domain/fare-allocation";
import { logger } from "@/lib/logger";

export function createMatchingApplication(
  repo: MatchingRepository,
  engine: MatchingService,
  routingSource: string,
) {
  return {
    async match(sessionId: string, userId: string) {
      const snapshot = await repo.snapshot(sessionId, userId);
      if (snapshot.kind === "assigned")
        return { createdPartyCount: 0, alreadyMatched: true };
      const result = await engine.match(
        snapshot.candidates.map((c) => ({
          ...c,
          destination: { latitude: c.latitude, longitude: c.longitude },
        })),
        {
          origin: snapshot.origin,
          vehicleCapacity: snapshot.session.vehicleCapacity,
          maxDetourSeconds: MAX_DETOUR_SECONDS,
        },
      );
      const plans: MatchingRoutePlan[] = result.parties.map((party) => {
        const shares = allocateBySegmentDistance(
          party.route.legs.map((l) => l.distanceMeters),
        );
        let arrival = 0;
        return {
          policyVersion: "road-v1",
          estimatedAt: new Date().toISOString(),
          routingSource,
          origin: snapshot.origin,
          maxDetourSeconds: MAX_DETOUR_SECONDS,
          route: party.route,
          stops: party.members.map((member, i) => {
            const c = snapshot.candidates.find(
              (c) => c.participantId === member.participantId,
            )!;
            arrival += party.route.legs[i].durationSeconds;
            return {
              ...member,
              displayName: c.displayName,
              destinationLabel: c.destinationLabel,
              destination: { latitude: c.latitude, longitude: c.longitude },
              directDurationSeconds: party.directDurationSeconds[i],
              arrivalSeconds: arrival,
              detourSeconds: Math.max(
                0,
                arrival - party.directDurationSeconds[i],
              ),
              fareShareBps: shares[i],
            };
          }),
        };
      });
      const outcome = await repo.commit(sessionId, userId, snapshot, plans);
      logger.info("Matching round completed", {
        sessionId,
        candidateCount: snapshot.candidates.length,
        createdPartyCount: outcome.createdPartyCount,
        unmatchedCount: result.unmatched.length,
      });
      return outcome;
    },
  };
}
