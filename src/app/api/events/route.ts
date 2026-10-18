import { randomUUID } from "node:crypto";
import { clientKey } from "@/app/api/auth/client-key";
import { clientEventBatch } from "@/lib/client-events";
import { logger } from "@/lib/logger";
import { consume } from "@/lib/rate-limit";
import { runWithRequest } from "@/lib/request-context";
import { readIdentity } from "@/modules/participants/infrastructure/browser-identity";

/**
 * Browser interaction log: one `ui.<type>` line per event, tagged with the account when
 * signed in. Not wrapped in `handle`, so a batch of clicks is not also an `http.request`
 * line, and it always answers 204: telemetry must never surface an error to the page.
 */
export async function POST(request: Request) {
  return runWithRequest(
    { requestId: randomUUID(), method: "POST", route: "/api/events" },
    async () => {
      try {
        const batch = clientEventBatch.safeParse(
          JSON.parse((await request.text()).slice(0, 20_000)),
        );
        if (!batch.success) {
          logger.debug("ui.rejected", { issues: batch.error.issues.length });
          return new Response(null, { status: 204 });
        }
        if (!(await consume(`events:${clientKey(request)}`, 120, 60_000)))
          return new Response(null, { status: 204 });
        const identity = await readIdentity().catch(() => null);
        for (const { type, ...event } of batch.data.events)
          logger[type === "error" ? "warn" : "info"](`ui.${type}`, {
            tab: batch.data.tab,
            ...(identity && { userId: identity.userId }),
            ...event,
          });
      } catch (error) {
        logger.debug("ui.unreadable", {
          errorType: error instanceof Error ? error.name : typeof error,
        });
      }
      return new Response(null, { status: 204 });
    },
  );
}
