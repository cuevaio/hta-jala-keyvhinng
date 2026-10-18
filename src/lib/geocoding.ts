import { z } from "zod";
import type { GeoPoint } from "@/modules/events/domain/event";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

const reverseSchema = z.object({ display_name: z.string().min(1) });

/**
 * Resolves a human-readable address for a point, or null when none is found.
 *
 * Uses OpenStreetMap's public Nominatim, which allows ~1 request/second and must not
 * back production traffic. Callers should only call it on a deliberate user action and
 * pass a `signal` so a newer pick cancels the older lookup. A failure is not fatal:
 * the user can still type the address themselves.
 */
export async function reverseGeocode(
  point: GeoPoint,
  options: { signal?: AbortSignal; fetch?: typeof fetch } = {},
): Promise<string | null> {
  const url = new URL(NOMINATIM_URL);
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: String(point.latitude),
    lon: String(point.longitude),
    zoom: "18",
    "accept-language": "es",
  }).toString();

  const response = await (options.fetch ?? fetch)(url, {
    signal: options.signal,
  });
  if (!response.ok) return null;
  const parsed = reverseSchema.safeParse(await response.json());
  return parsed.success ? parsed.data.display_name : null;
}
