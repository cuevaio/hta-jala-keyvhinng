"use client";

import { useEffect, useRef } from "react";
import type { GeoPoint } from "@/modules/places/domain/place";
import "leaflet/dist/leaflet.css";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export type RideEnd = "origin" | "destination";

const PIN_LABELS: Record<RideEnd, string> = {
  origin: "Tu punto de salida",
  destination: "Tu destino",
};

/**
 * One map for both ends of the ride. A tap places the `active` end; either pin can be
 * dragged. Leaflet touches `window`, so it is imported inside the effect and this
 * component never runs on the server. The parent owns both points.
 */
export function RideMap({
  center,
  origin,
  destination,
  active,
  focus,
  onPick,
}: {
  center: GeoPoint;
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  active: RideEnd;
  /** When it changes, the view moves there (after a search or "use my location"). */
  focus: GeoPoint | null;
  onPick: (end: RideEnd, point: GeoPoint) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  const activeRef = useRef(active);
  const pointsRef = useRef({ origin, destination });
  const sync = useRef<() => void>(() => {});
  const moveView = useRef<(point: GeoPoint) => void>(() => {});

  useEffect(() => {
    onPickRef.current = onPick;
    activeRef.current = active;
  });

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      // One-finger drags scroll the page on phones; two fingers pan and pinch the map.
      const map = L.map(container.current, {
        dragging: !L.Browser.mobile,
        touchZoom: true,
        scrollWheelZoom: false,
      }).setView([center.latitude, center.longitude], 14);
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(
        map,
      );
      const markers: Partial<Record<RideEnd, import("leaflet").Marker>> = {};
      const line = L.polyline([], {
        color: "#FF6B35",
        weight: 4,
        dashArray: "7 8",
        opacity: 0.9,
      }).addTo(map);

      // CSS pins avoid Leaflet's default marker images, which bundlers break.
      const icon = (end: RideEnd) =>
        L.divIcon({
          className: "ride-pin-wrap",
          html: `<span class="ride-pin ride-pin-${end}">${end === "origin" ? "J" : ""}</span>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

      const place = (end: RideEnd, point: GeoPoint | null) => {
        const existing = markers[end];
        if (!point) {
          existing?.remove();
          delete markers[end];
          return;
        }
        const latlng: [number, number] = [point.latitude, point.longitude];
        if (existing) {
          existing.setLatLng(latlng);
          return;
        }
        const marker = L.marker(latlng, {
          icon: icon(end),
          draggable: true,
          alt: PIN_LABELS[end],
          title: `${PIN_LABELS[end]}. Arrástralo para afinarlo.`,
        }).addTo(map);
        marker.on("dragend", () => {
          const { lat, lng } = marker.getLatLng();
          onPickRef.current(end, { latitude: lat, longitude: lng });
        });
        markers[end] = marker;
      };

      sync.current = () => {
        const { origin, destination } = pointsRef.current;
        place("origin", origin);
        place("destination", destination);
        line.setLatLngs(
          origin && destination
            ? [
                [origin.latitude, origin.longitude],
                [destination.latitude, destination.longitude],
              ]
            : [],
        );
      };

      map.on("click", (event) => {
        onPickRef.current(activeRef.current, {
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        });
      });
      // With both ends known, frame the whole ride; otherwise look at the new point.
      moveView.current = (point) => {
        const { origin, destination } = pointsRef.current;
        if (origin && destination)
          map.fitBounds(
            [
              [origin.latitude, origin.longitude],
              [destination.latitude, destination.longitude],
            ],
            { padding: [60, 60], maxZoom: 15 },
          );
        else map.setView([point.latitude, point.longitude], 15);
      };
      sync.current();
      cleanup = () => map.remove();
    });

    return () => {
      disposed = true;
      sync.current = () => {};
      moveView.current = () => {};
      cleanup();
    };
    // The map is created once; `center` only seeds it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pointsRef.current = { origin, destination };
    sync.current();
  }, [origin, destination]);

  useEffect(() => {
    if (focus) moveView.current(focus);
  }, [focus]);

  return (
    <div
      ref={container}
      className="ride-map"
      role="group"
      aria-label="Mapa para marcar tu salida y tu destino. Si prefieres no usar el mapa, busca las direcciones en el formulario."
    />
  );
}
