"use client";

import { useState, type FormEvent } from "react";
import { CarFront, Clock3, ShieldCheck, UserRound } from "lucide-react";
import type { GeoPoint } from "@/modules/places/domain/place";
import {
  DEPARTURE_CHOICES,
  type DepartureChoice,
} from "@/modules/sessions/domain/affinity";
import { LocationPicker, type PickedLocation } from "./location-picker";

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
  originMapCenter,
  destinationMapCenter,
  autoLocate,
  onSubmit,
}: {
  initial: RideDraft;
  defaultName: string;
  showTime: boolean;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  originMapCenter: GeoPoint;
  destinationMapCenter: GeoPoint;
  autoLocate: boolean;
  onSubmit: (values: RideValues) => void;
}) {
  const [origin, setOrigin] = useState(initial.origin);
  const [destination, setDestination] = useState(initial.destination);
  const [when, setWhen] = useState<DepartureChoice>(initial.departInMinutes);

  const ready = Boolean(
    origin?.point &&
    origin.label.trim().length >= 3 &&
    destination?.point &&
    destination.label.trim().length >= 3,
  );

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
    <form onSubmit={submit} className="join-form ride-form">
      <LocationPicker
        id="origin"
        legend="¿Dónde estás?"
        help="Te juntamos con personas que salen cerca de ti."
        value={origin}
        onChange={setOrigin}
        mapCenter={originMapCenter}
        pinLabel="Tu punto de salida"
        variant="origin"
        locate
        autoLocate={autoLocate}
      />
      <LocationPicker
        id="destination"
        legend="¿A dónde vas?"
        help="Cada persona conserva su destino exacto. Agrupamos a quienes van hacia la misma zona."
        value={destination}
        onChange={setDestination}
        mapCenter={destinationMapCenter}
        pinLabel="Tu destino"
        variant="destination"
      />
      {showTime && (
        <fieldset className="when-section">
          <legend>
            <Clock3 size={19} aria-hidden="true" /> ¿Cuándo sales?
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
        <label htmlFor="display-name">¿Cómo te llamas?</label>
        <div className="input-with-icon">
          <UserRound size={19} aria-hidden="true" />
          <input
            id="display-name"
            className="form-input"
            name="displayName"
            key={defaultName}
            defaultValue={defaultName}
            required
            maxLength={60}
            autoComplete="nickname"
            placeholder="Tu nombre para el grupo"
          />
        </div>
        <p className="input-help">Las otras personas verán este nombre.</p>
      </div>
      <fieldset className="delegate-section">
        <legend>¿Puedes reservar el taxi?</legend>
        <p className="input-help">
          Una persona del grupo lo reservará en una app externa.
        </p>
        <div className="delegate-choices">
          <label className="delegate-choice">
            <input
              type="radio"
              name="delegatePreference"
              value="passenger"
              defaultChecked
            />
            <span>
              <UserRound size={20} aria-hidden="true" />
              <strong>Voy de pasajero</strong>
              <span>Prefiero que otra persona reserve.</span>
            </span>
          </label>
          <label className="delegate-choice">
            <input type="radio" name="delegatePreference" value="delegate" />
            <span>
              <CarFront size={20} aria-hidden="true" />
              <strong>Puedo reservar</strong>
              <span>Yo pido el taxi y pago mi parte.</span>
            </span>
          </label>
        </div>
      </fieldset>
      <p className="privacy-note">
        <ShieldCheck size={19} aria-hidden="true" />
        <span>
          Tu dirección exacta solo la ven las personas de tu grupo. Esta demo no
          verifica identidades ni realiza cobros.
        </span>
      </p>
      <button
        disabled={busy || !ready}
        aria-describedby="ride-hint"
        className="action action-primary form-submit"
      >
        {busy ? busyLabel : submitLabel}
      </button>
      <p id="ride-hint" className="input-help" role="status">
        {!ready && !busy
          ? "Marca dónde estás y a dónde vas para continuar."
          : ""}
      </p>
    </form>
  );
}
