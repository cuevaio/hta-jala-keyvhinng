"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  CarFront,
  Clock3,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { GeoPoint } from "@/modules/places/domain/place";
import {
  DEPARTURE_CHOICES,
  type DepartureChoice,
} from "@/modules/sessions/domain/affinity";
import { LocationPicker, type PickedLocation } from "./location-picker";
import { RideMap, type RideEnd } from "./ride-map";

export interface RideValues {
  displayName: string;
  origin: { point: GeoPoint; label: string };
  destination: { point: GeoPoint; label: string };
  departInMinutes: DepartureChoice;
  delegatePreference: "delegate" | "passenger";
}

export interface RideDraft {
  origin: PickedLocation | null;
  destination: PickedLocation | null;
  departInMinutes: DepartureChoice;
}

const WHEN_LABELS: Record<DepartureChoice, string> = {
  0: "Ahora",
  15: "En 15 min",
  30: "En 30 min",
  60: "En 1 hora",
};

/** Lima, used only to center a map before anything is known. */
export const DEFAULT_MAP_CENTER: GeoPoint = {
  latitude: -12.0464,
  longitude: -77.0428,
};

/**
 * The questions every ride asks: where are you, where are you going, when, and can
 * you order the taxi. The time question is hidden when the group already has one.
 */
export function RideForm({
  initial,
  defaultName,
  showTime,
  submitLabel,
  busyLabel,
  busy,
  mapCenter,
  autoLocate,
  onSubmit,
}: {
  initial: RideDraft;
  defaultName: string;
  showTime: boolean;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  mapCenter: GeoPoint;
  autoLocate: boolean;
  onSubmit: (values: RideValues) => void;
}) {
  const [origin, setOrigin] = useState(initial.origin);
  const [destination, setDestination] = useState(initial.destination);
  const [when, setWhen] = useState<DepartureChoice>(initial.departInMinutes);
  const [active, setActive] = useState<RideEnd>(
    initial.origin?.point ? "destination" : "origin",
  );
  const [focus, setFocus] = useState<GeoPoint | null>(null);

  const ready = Boolean(
    origin?.point &&
    origin.label.trim().length >= 3 &&
    destination?.point &&
    destination.label.trim().length >= 3,
  );

  function changeOrigin(next: PickedLocation | null) {
    setOrigin(next);
    // With the start known, the next tap on the map is most likely the destination.
    if (next?.point && !origin?.point && !destination?.point)
      setActive("destination");
  }

  function pickOnMap(end: RideEnd, point: GeoPoint) {
    if (end === "origin") changeOrigin({ point, label: origin?.label ?? "" });
    else setDestination({ point, label: destination?.label ?? "" });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!origin?.point || !destination?.point) return;
    const data = new FormData(event.currentTarget);
    onSubmit({
      displayName: String(data.get("displayName") ?? ""),
      origin: { point: origin.point, label: origin.label.trim() },
      destination: {
        point: destination.point,
        label: destination.label.trim(),
      },
      departInMinutes: when,
      delegatePreference:
        data.get("delegatePreference") === "delegate"
          ? "delegate"
          : "passenger",
    });
  }

  return (
    <form onSubmit={submit} className="ride-form">
      <div className="panel ride-route">
        <LocationPicker
          id="origin"
          end="origin"
          value={origin}
          onChange={changeOrigin}
          onActivate={() => setActive("origin")}
          onFocusPoint={setFocus}
          locate
          autoLocate={autoLocate}
        />
        <LocationPicker
          id="destination"
          end="destination"
          value={destination}
          onChange={setDestination}
          onActivate={() => setActive("destination")}
          onFocusPoint={setFocus}
          autoSearch
        />
      </div>

      <div className="ride-map-pane">
        <div
          className="map-mode"
          role="group"
          aria-label="Al tocar el mapa marcas"
        >
          <span aria-hidden="true">Tocar el mapa marca</span>
          {(["origin", "destination"] as const).map((end) => (
            <button
              key={end}
              type="button"
              aria-pressed={active === end}
              onClick={() => setActive(end)}
            >
              {end === "origin" ? "Partida" : "Destino"}
            </button>
          ))}
        </div>
        <RideMap
          center={origin?.point ?? mapCenter}
          origin={origin?.point ?? null}
          destination={destination?.point ?? null}
          active={active}
          focus={focus}
          onPick={pickOnMap}
        />
        <p className="map-label">
          Arrastra un punto para afinarlo
          <span className="touch-hint">. Mueve el mapa con dos dedos</span>.
        </p>
      </div>

      <div className="panel ride-details">
        {showTime && (
          <fieldset className="when-section">
            <legend>
              <Clock3 size={16} aria-hidden="true" /> ¿Cuándo sales?
            </legend>
            <div className="when-choices">
              {DEPARTURE_CHOICES.map((choice) => (
                <label key={choice} className="when-choice">
                  <input
                    type="radio"
                    name="departInMinutes"
                    checked={when === choice}
                    onChange={() => setWhen(choice)}
                  />
                  <span>{WHEN_LABELS[choice]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="form-section">
          <label htmlFor="display-name">Tu nombre</label>
          <input
            id="display-name"
            className="form-input"
            name="displayName"
            key={defaultName}
            defaultValue={defaultName}
            required
            maxLength={60}
            autoComplete="nickname"
            placeholder="Cómo te verán los demás"
          />
        </div>
        <fieldset className="delegate-section">
          <legend>¿Puedes reservar el taxi?</legend>
          <div className="delegate-choices">
            <label className="delegate-choice">
              <input
                type="radio"
                name="delegatePreference"
                value="passenger"
                defaultChecked
              />
              <span>
                <UserRound size={19} aria-hidden="true" />
                <strong>Voy de pasajero</strong>
                <span>Prefiero que otra persona reserve.</span>
              </span>
            </label>
            <label className="delegate-choice">
              <input type="radio" name="delegatePreference" value="delegate" />
              <span>
                <CarFront size={19} aria-hidden="true" />
                <strong>Puedo reservar</strong>
                <span>Lo reservo en mi app y pago mi parte.</span>
              </span>
            </label>
          </div>
        </fieldset>
        <button
          disabled={busy || !ready}
          aria-describedby="ride-hint"
          className="action action-primary form-submit"
        >
          {busy ? busyLabel : submitLabel}
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </button>
        <p id="ride-hint" className="fine" role="status">
          {!ready && !busy ? (
            "Marca tu punto de partida y tu destino para continuar."
          ) : (
            <>
              <ShieldCheck size={16} aria-hidden="true" />
              Tu destino exacto se comparte con tu grupo de viaje cuando se
              forma.
            </>
          )}
        </p>
      </div>
    </form>
  );
}
