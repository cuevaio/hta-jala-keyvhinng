"use client";

import { useEffect, useRef } from "react";
import type { GeoPoint } from "@/modules/events/domain/event";
import "leaflet/dist/leaflet.css";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Tap-to-pin map. Leaflet touches `window`, so it is imported inside the effect and
 * this component never runs on the server. The parent owns the point; the map only
 * reports user picks through `onPick` and mirrors `value` back onto the marker.
 */
export function DestinationMap({
  center,
  value,
  onPick,
}: {
  center: GeoPoint;
  value: GeoPoint | null;
  onPick: (point: GeoPoint) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  const valueRef = useRef(value);
  const syncMarker = useRef<(point: GeoPoint | null) => void>(() => {});

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      const map = L.map(container.current).setView(
        [center.latitude, center.longitude],
        14,
      );
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(
        map,
      );
      // A CSS pin avoids Leaflet's default marker images, which bundlers break.
      const icon = L.divIcon({
        className: "destination-pin",
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      let marker: import("leaflet").Marker | null = null;

      const place = (point: GeoPoint) => {
        const latlng: [number, number] = [point.latitude, point.longitude];
        if (marker) {
          marker.setLatLng(latlng);
          return;
        }
        marker = L.marker(latlng, { icon, draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const { lat, lng } = marker!.getLatLng();
          onPickRef.current({ latitude: lat, longitude: lng });
        });
      };

      map.on("click", (event) => {
        place({ latitude: event.latlng.lat, longitude: event.latlng.lng });
        onPickRef.current({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        });
      });

      syncMarker.current = (point) => {
        if (point) place(point);
        else if (marker) {
          marker.remove();
          marker = null;
        }
      };
      syncMarker.current(valueRef.current);
      cleanup = () => map.remove();
    });

    return () => {
      disposed = true;
      syncMarker.current = () => {};
      cleanup();
    };
    // The map is created once; `center` only seeds the initial view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    valueRef.current = value;
    syncMarker.current(value);
  }, [value]);

  return (
    <div
      ref={container}
      className="destination-map"
      role="application"
      aria-label="Mapa para marcar tu destino. Toca el mapa para colocar el punto."
    />
  );
}
