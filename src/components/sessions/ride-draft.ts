import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { DEPARTURE_CHOICES } from "@/modules/sessions/domain/affinity";
import type { RideDraft } from "./ride-form";

/**
 * A ride someone started before signing in. It waits in this tab's session storage
 * rather than in the sign-in link, so exact addresses never land in URLs, browser
 * history or server logs.
 */
const KEY = "jala:ride-draft";

const point = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
const location = z.object({
  point: point.nullable(),
  label: z.string().max(200),
  area: z.string().max(60).optional(),
});
const draftSchema = z.object({
  origin: location.nullable(),
  destination: location.nullable(),
  departInMinutes: z
    .number()
    .refine((n): n is RideDraft["departInMinutes"] =>
      (DEPARTURE_CHOICES as readonly number[]).includes(n),
    ),
});

/** Stores the route only: callers may pass values that also hold a name or selfie. */
export function saveRideDraft({
  origin,
  destination,
  departInMinutes,
}: RideDraft) {
  const place = (p: RideDraft["origin"]) =>
    p && { point: p.point, label: p.label, area: p.area };
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        origin: place(origin),
        destination: place(destination),
        departInMinutes,
      }),
    );
  } catch {
    // Private mode or storage full: the person picks the route again.
  }
}

function rawDraft() {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parseDraft(raw: string | null): RideDraft | null {
  if (!raw) return null;
  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Storage is only written by this tab right before it navigates away.
const noSubscription = () => () => {};

/** The saved route, read after hydration so the server render never depends on it. */
export function useSavedRideDraft(): RideDraft | null {
  const raw = useSyncExternalStore(noSubscription, rawDraft, () => null);
  return useMemo(() => parseDraft(raw), [raw]);
}

export function clearRideDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
