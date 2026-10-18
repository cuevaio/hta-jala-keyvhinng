import { and, eq, lt, not, or } from "drizzle-orm";
import { rideParties } from "@/db/schema";

/** SQL for groups that missed a deadline but have not been swept yet. */
export const missedDeadline = (now: Date) =>
  or(
    and(eq(rideParties.status, "forming"), lt(rideParties.confirmBy, now)),
    and(eq(rideParties.status, "confirmed"), lt(rideParties.startBy, now)),
  )!;

/** Live groups that still count: an expired one no longer holds its members. */
export const withinDeadline = (now: Date) => not(missedDeadline(now));
