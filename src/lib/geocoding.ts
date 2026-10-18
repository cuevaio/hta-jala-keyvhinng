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

const PHOTON_URL = "https://photon.komoot.io/api/";

const photonText = z.string().min(1).optional();
const searchSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.object({
        name: photonText,
        housenumber: photonText,
        street: photonText,
        district: photonText,
        city: photonText,
        state: photonText,
      }),
    }),
  ),
});

export interface AddressMatch {
  label: string;
  point: GeoPoint;
}

/**
 * Forward search restricted to Peru, safe to call while the person types.
 *
 * Uses komoot's public Photon (same OpenStreetMap data as Nominatim), which is built
 * for search-as-you-type; Nominatim's policy forbids autocomplete. Callers debounce
 * keystrokes and pass a `signal` so each new keystroke cancels the older request.
 * Photon has no Spanish locale, so labels use OSM's local (Spanish) names.
 */
export async function searchAddress(
  query: string,
  options: { signal?: AbortSignal; fetch?: typeof fetch } = {},
): Promise<AddressMatch[]> {
  const url = new URL(PHOTON_URL);
  url.search = new URLSearchParams({
    q: query,
    countrycode: "PE",
    limit: "5",
    // Photon has no Spanish; without this it follows the browser's language.
    lang: "default",
  }).toString();
  const response = await (options.fetch ?? fetch)(url, {
    signal: options.signal,
  });
  if (!response.ok) return [];
  const parsed = searchSchema.safeParse(await response.json());
  if (!parsed.success) return [];
  const seen = new Set<string>();
  return parsed.data.features
    .map(({ geometry, properties: p }) => {
      const street = p.street
        ? [p.street, p.housenumber].filter(Boolean).join(" ")
        : undefined;
      const parts = [p.name, street, p.district, p.city, p.state];
      return {
        label: parts
          .filter((part, i): part is string =>
            Boolean(part && parts.indexOf(part) === i),
          )
          .join(", "),
        point: {
          latitude: geometry.coordinates[1],
          longitude: geometry.coordinates[0],
        },
      };
    })
    .filter((m) => {
      if (!m.label || seen.has(m.label)) return false;
      seen.add(m.label);
      return (
        Number.isFinite(m.point.latitude) && Number.isFinite(m.point.longitude)
      );
    });
}
