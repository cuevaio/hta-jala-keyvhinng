"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import {
  LocationPicker,
  type PickedLocation,
} from "@/components/sessions/location-picker";

/** Carries the selected starting point or typed address into the ride form. */
export function HeroSearch() {
  const router = useRouter();
  const [origin, setOrigin] = useState<PickedLocation | null>(null);
  const [destination, setDestination] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (origin?.point) {
      query.set("olat", String(origin.point.latitude));
      query.set("olng", String(origin.point.longitude));
      query.set("olabel", origin.label);
    } else if (origin?.label.trim()) {
      query.set("oq", origin.label.trim());
    }
    if (destination.trim().length >= 3) query.set("dq", destination.trim());
    const search = query.toString();
    router.push(search ? `/ride?${search}` : "/ride");
  }

  return (
    <form className="search-form" onSubmit={submit}>
      <LocationPicker
        id="home-origin"
        end="origin"
        value={origin}
        onChange={setOrigin}
        onActivate={() => {}}
        onFocusPoint={() => {}}
        locate
      />
      <label>
        <span>
          <MapPin size={14} aria-hidden="true" /> ¿A dónde vas?
        </span>
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          maxLength={200}
          enterKeyHint="search"
          placeholder="Distrito, calle o lugar"
        />
      </label>
      <button className="action action-primary" type="submit">
        Buscar compañeros de viaje
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </form>
  );
}
