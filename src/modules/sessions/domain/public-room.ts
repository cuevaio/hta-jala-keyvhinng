import type { GeoPoint } from "@/modules/places/domain/place";

/**
 * Rooms are listed publicly, so they carry only a coarse destination: a ~1.1 km grid
 * cell and the district name. The member's exact address stays on their private
 * participant row. A grid cell is at most ~0.8 km from the real point, well inside
 * the 3 km destination radius rooms match on.
 */
export const PUBLIC_ANCHOR_STEP_DEGREES = 0.01;

const snap = (value: number) =>
  Math.round(value / PUBLIC_ANCHOR_STEP_DEGREES) * PUBLIC_ANCHOR_STEP_DEGREES;

export function publicAnchor(point: GeoPoint): GeoPoint {
  return {
    latitude: Number(snap(point.latitude).toFixed(2)),
    longitude: Number(snap(point.longitude).toFixed(2)),
  };
}

/** What a room says about where it is going, from the creator's district only. */
export function publicDestination(area: string | undefined) {
  return { label: area?.trim() || "Destino cercano" };
}

/**
 * Rooms are told apart by a friendly name, handed out in turn so rooms opened around
 * the same time never share one. Names say nothing about the people in the room.
 */
export const ROOM_NAMES = [
  "Ceviche",
  "Lúcuma",
  "Picarones",
  "Chicha Morada",
  "Anticucho",
  "Causa",
  "Suspiro",
  "Alfajor",
  "Cancha",
  "Rocoto",
  "Huacatay",
  "Chirimoya",
  "Maracuyá",
  "Camu Camu",
  "Tumbo",
  "Tamal",
  "Mazamorra",
  "Turrón",
  "Choclo",
  "Aguaymanto",
] as const;

/** The name for the `sequence`-th room ever opened. */
export const roomName = (sequence: number) =>
  `Sala ${ROOM_NAMES[sequence % ROOM_NAMES.length]}`;
