"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import type { GeoPoint } from "@/modules/places/domain/place";

export interface OriginChoice {
  id: string;
  name: string;
  location: GeoPoint;
}

const HERE = "here";
const CUSTOM = "custom";

/**
 * The landing's shortcut into /ride. It only carries what was typed; the ride page
 * runs the address search so the person picks the exact match themselves.
 */
export function HeroSearch({ origins }: { origins: OriginChoice[] }) {
  const router = useRouter();
  const [origin, setOrigin] = useState(HERE);
  const [originAddress, setOriginAddress] = useState("");
  const [destination, setDestination] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    const place = origins.find((o) => o.id === origin);
    if (place) {
      query.set("olat", String(place.location.latitude));
      query.set("olng", String(place.location.longitude));
      query.set("olabel", place.name);
    }
    if (origin === CUSTOM) query.set("oq", originAddress.trim());
    if (destination.trim().length >= 3) query.set("dq", destination.trim());
    const search = query.toString();
    router.push(search ? `/ride?${search}` : "/ride");
  }

  return (
    <form className="search-form" onSubmit={submit}>
      <label>
        <span>
          <span className="dot" aria-hidden="true" /> Punto de partida
        </span>
        <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
          <option value={HERE}>Mi ubicación actual</option>
          <option value={CUSTOM}>Otra dirección</option>
          {origins.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {origin === CUSTOM && (
        <label>
          <span>Dirección de partida</span>
          <input
            value={originAddress}
            onChange={(e) => setOriginAddress(e.target.value)}
            required
            minLength={3}
            maxLength={200}
            placeholder="Distrito, calle o lugar de partida"
          />
        </label>
      )}
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
