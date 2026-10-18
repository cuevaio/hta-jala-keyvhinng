/** Anchor server time to elapsed monotonic time, never to the device wall clock. */
export function createRoomClock(
  serverNow: string,
  elapsed = () => performance.now(),
) {
  let sample = Date.parse(serverNow);
  let anchor = sample;
  let receivedAt = elapsed();
  return {
    now: () => anchor + Math.max(0, elapsed() - receivedAt),
    synchronize(serverNow: string, roundTripMs = 0) {
      const next = Date.parse(serverNow);
      // An older action response must not rewind a newer polling sample.
      if (!Number.isFinite(next) || next < sample) return;
      sample = next;
      // Transport delay is approximate; cap it so slow DB requests cannot move the clock far ahead.
      anchor = next + Math.min(1000, Math.max(0, roundTripMs / 2));
      receivedAt = elapsed();
    },
  };
}

export function roomDeadline(closesAt: string, now: number) {
  const remainingMs = Math.max(0, Date.parse(closesAt) - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(seconds / 60);
  return {
    remainingMs,
    phase:
      remainingMs === 0
        ? "closed"
        : remainingMs <= 5 * 60_000
          ? "closing"
          : "open",
    label: `${minutes}:${String(seconds % 60).padStart(2, "0")}`,
  };
}
