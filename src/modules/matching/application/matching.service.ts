import type { MatchingService } from "../domain/matching";
import type { MatchingRoutePlan } from "../domain/route-plan";
import { MAX_DETOUR_SECONDS } from "../domain/road-matching";
import {
  alreadyAssigned,
  MatchingError,
  type MatchingOutcome,
  type MatchingRepository,
} from "../infrastructure/matching.repository";
import { RoutingError } from "@/modules/routing/domain/routing-provider";
import { allocateBySegmentDistance } from "@/modules/payments/domain/fare-allocation";
import { logger } from "@/lib/logger";

export function createMatchingApplication(
  repo: MatchingRepository,
  engine: MatchingService,
  routingSource: string,
) {
  async function match(
    sessionId: string,
    userId: string,
  ): Promise<MatchingOutcome> {
    const snapshot = await repo.snapshot(sessionId, userId);
    if (snapshot.kind === "assigned") return alreadyAssigned();
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
  }

  return {
    match,
    /**
     * Matches on someone's behalf when the room changes (a join, a dissolved party), so
     * nobody has to press a button for a compatible group to form. Never throws: the
     * caller already answered its own request, and a person can still match manually.
     */
    async matchInBackground(
      sessionId: string,
      userId: string,
    ): Promise<MatchingOutcome | null> {
      // A concurrent join or match can change the room between snapshot and commit.
      for (let attempt = 1; ; attempt++) {
        try {
          return await match(sessionId, userId);
        } catch (error) {
          const changed =
            error instanceof MatchingError &&
            error.code === "matching_snapshot_changed";
          if (changed && attempt < 3) continue;
          // Room closed or person gone is routine; routing down is worth a look.
          const level =
            error instanceof MatchingError
              ? "info"
              : error instanceof RoutingError
                ? "warn"
                : "error";
          logger[level]("Background matching skipped", {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      }
    },
  };
}
