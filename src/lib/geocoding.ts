import { z } from "zod";
import type { GeoPoint } from "@/modules/places/domain/place";

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

const searchSchema = z.array(
  z.object({
    display_name: z.string().min(1),
    lat: z.string(),
    lon: z.string(),
  }),
);

export interface AddressMatch {
  label: string;
  point: GeoPoint;
}

/**
 * Forward search biased to Peru. Same Nominatim limits as `reverseGeocode`: call it
 * only on a deliberate user action (a submitted search), never while typing.
 */
export async function searchAddress(
  query: string,
  options: { signal?: AbortSignal; fetch?: typeof fetch } = {},
): Promise<AddressMatch[]> {
  const url = new URL(NOMINATIM_URL.replace("/reverse", "/search"));
  url.search = new URLSearchParams({
    format: "jsonv2",
    q: query,
    countrycodes: "pe",
    limit: "5",
    "accept-language": "es",
  }).toString();
  const response = await (options.fetch ?? fetch)(url, {
    signal: options.signal,
  });
  if (!response.ok) return [];
  const parsed = searchSchema.safeParse(await response.json());
  if (!parsed.success) return [];
  return parsed.data
    .map((row) => ({
      label: row.display_name,
      point: { latitude: Number(row.lat), longitude: Number(row.lon) },
    }))
    .filter(
      (m) =>
        Number.isFinite(m.point.latitude) && Number.isFinite(m.point.longitude),
    );
}
