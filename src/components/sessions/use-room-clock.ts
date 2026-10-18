"use client";

import { useCallback, useEffect, useState } from "react";
import { createRoomClock } from "./room-clock";

export function useRoomClock(initialServerNow: string) {
  const [clock] = useState(() => createRoomClock(initialServerNow));
  // Identical SSR and hydration output, even with a misconfigured device clock.
  const [now, setNow] = useState(() => Date.parse(initialServerNow));
  useEffect(() => {
    const tick = () => setNow(clock.now());
    const timer = setInterval(tick, 1000);
    const visible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [clock]);
  const synchronize = useCallback(
    (serverNow: string, roundTripMs = 0) => {
      clock.synchronize(serverNow, roundTripMs);
      setNow(clock.now());
    },
    [clock],
  );
  return { now, synchronize };
}
