/** How often an open room checks for changes; an unchanged check is one indexed read. */
export const POLL_MS = 3000;
/** Upper bound between retries while the server or network is failing. */
export const MAX_BACKOFF_MS = 30_000;
/** A full room fetch at least this often heals any change that missed a revision bump. */
export const FULL_REFRESH_MS = 30_000;

/**
 * Delay before the next poll. Healthy polls get ±10% jitter so phones that opened the
 * room together drift apart; failures back off exponentially with jitter so an outage
 * is not met by every client retrying in lockstep.
 */
export function nextPollDelay(failures: number, random = Math.random) {
  if (failures <= 0) return Math.round(POLL_MS * (0.9 + 0.2 * random()));
  const ceiling = Math.min(MAX_BACKOFF_MS, POLL_MS * 2 ** failures);
  return Math.round(ceiling / 2 + (ceiling / 2) * random());
}
