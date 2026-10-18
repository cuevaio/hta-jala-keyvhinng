"use client";

import { useEffect, useRef } from "react";
import type { MatchingRoutePlan } from "@/modules/matching/domain/route-plan";
import "leaflet/dist/leaflet.css";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Draws a saved route plan: the pickup, then each drop-off numbered in order, joined
 * by the road geometry when the provider returned it. Display only; the plan is never
 * recomputed here.
 */
export function RouteMap({ plan }: { plan: MatchingRoutePlan }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      const map = L.map(container.current, {
        dragging: !L.Browser.mobile,
        scrollWheelZoom: false,
      });
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(
        map,
      );
      const pin = (text: string, className: string) =>
        L.divIcon({
          className: "route-pin-wrap",
          html: `<span class="route-pin ${className}">${text}</span>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
      const toLatLng = (p: { latitude: number; longitude: number }) =>
        [p.latitude, p.longitude] as [number, number];

      const line = (
        plan.route.geometry?.length
          ? plan.route.geometry
          : [plan.origin, ...plan.stops.map((s) => s.destination)]
      ).map(toLatLng);
      L.polyline(line, {
        color: "#2457E6",
        weight: 5,
        opacity: 0.8,
        dashArray: plan.route.geometry?.length ? undefined : "6 8",
      }).addTo(map);
      L.marker(toLatLng(plan.origin), {
        icon: pin("●", "route-pin-origin"),
        alt: `Punto de encuentro: ${plan.origin.label}`,
        title: plan.origin.label,
      }).addTo(map);
      for (const stop of plan.stops)
        L.marker(toLatLng(stop.destination), {
          icon: pin(String(stop.dropOffOrder), ""),
          alt: `Parada ${stop.dropOffOrder}`,
          title: `${stop.dropOffOrder}. ${stop.displayName}`,
        }).addTo(map);
      map.fitBounds(L.latLngBounds(line), { padding: [28, 28] });
      cleanup = () => map.remove();
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [plan]);

  return (
    <div
      ref={container}
      className="route-map"
      role="group"
      aria-label="Mapa de la ruta: el punto de encuentro y cada parada en orden."
    />
  );
}
