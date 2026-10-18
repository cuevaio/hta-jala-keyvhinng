import type { GeoPoint } from "@/modules/places/domain/place";
import type { RouteEstimate } from "@/modules/routing/domain/routing-provider";

/** Immutable estimate saved when participants are assigned; never recomputed on reads. */
export interface MatchingRoutePlan {
  policyVersion: "road-v1";
  estimatedAt: string;
  routingSource: string;
  origin: GeoPoint & { label: string };
  maxDetourSeconds: number;
  route: RouteEstimate;
  stops: {
    participantId: string;
    userId: string;
    displayName: string;
    destinationLabel: string;
    destination: GeoPoint;
    role: "delegate" | "passenger";
    dropOffOrder: number;
    directDurationSeconds: number;
    arrivalSeconds: number;
    detourSeconds: number;
    fareShareBps: number;
  }[];
}
