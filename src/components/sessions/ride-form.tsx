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
  formatSoles,
  PLATFORM_FEE_MINOR,
} from "@/modules/payments/domain/fees";
import {
  DEPARTURE_CHOICES,
  type DepartureChoice,
} from "@/modules/sessions/domain/affinity";
import { SelfieCapture } from "./selfie-capture";
import { LocationPicker, type PickedLocation } from "./location-picker";
import { RideMap, type RideEnd } from "./ride-map";

export interface RideValues {
  selfieDataUrl: string;
  origin: { point: GeoPoint; label: string };
  destination: { point: GeoPoint; label: string; area?: string };
  departInMinutes: DepartureChoice;
  delegatePreference: "delegate" | "passenger";
}

export interface RideDraft {
  origin: PickedLocation | null;
  destination: PickedLocation | null;
  departInMinutes: DepartureChoice;
  /** Chosen earlier (on Inicio), so the form starts with it. */
  delegatePreference?: "delegate" | "passenger";
}

const WHEN_LABELS: Record<DepartureChoice, string> = {
  0: "Ahora",
  15: "En 15 min",
  30: "En 30 min",
  60: "En 1 hora",
};

/** How each role is described wherever someone picks one; the fee lives here only. */
export const ROLE_COPY = {
  passenger: {
    title: "Voy de pasajero",
    detail: `Otra persona reserva. Comisión: ${formatSoles(PLATFORM_FEE_MINOR)}.`,
  },
  delegate: {
    title: "Puedo reservar",
    detail: "Pido el taxi en mi app y no pago comisión.",
  },
} as const;

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
  initialSelfie = "",
  showTime,
  submitLabel,
  busyLabel,
  busy,
  mapCenter,
  onSubmit,
  onRouteContinue,
}: {
  initial: RideDraft;
  initialSelfie?: string;
  showTime: boolean;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  mapCenter: GeoPoint;
  onSubmit: (values: RideValues) => void;
  onRouteContinue?: (
    route: Pick<RideValues, "origin" | "destination" | "departInMinutes">,
  ) => void;
}) {
  const [selfieDataUrl, setSelfieDataUrl] = useState(initialSelfie);
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
    destination.label.trim().length >= 3 &&
    (onRouteContinue || selfieDataUrl),
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
    if (!ready || !origin?.point || !destination?.point) return;
    if (onRouteContinue) {
      onRouteContinue({
        origin: { point: origin.point, label: origin.label.trim() },
        destination: {
          point: destination.point,
          label: destination.label.trim(),
          area: destination.area,
        },
        departInMinutes: when,
      });
      return;
    }
    const data = new FormData(event.currentTarget);
    onSubmit({
      selfieDataUrl,
      origin: { point: origin.point, label: origin.label.trim() },
      destination: {
        point: destination.point,
        label: destination.label.trim(),
        area: destination.area,
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
        />
        <LocationPicker
          id="destination"
          end="destination"
          value={destination}
          onChange={setDestination}
          onActivate={() => setActive("destination")}
          onFocusPoint={setFocus}
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
        {!onRouteContinue && (
          <>
            <div className="form-section">
              <span className="form-label" id="selfie-label">
                Tu selfie (obligatoria)
              </span>
              <SelfieCapture
                compact
                value={selfieDataUrl || null}
                onChange={(photo) => setSelfieDataUrl(photo ?? "")}
                disabled={busy}
                hint={
                  <p className="fine selfie-hint">
                    Que se vea tu rostro. Solo la verán tus compañeros cuando se
                    forme tu grupo de viaje.
                  </p>
                }
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
                    defaultChecked={initial.delegatePreference !== "delegate"}
                  />
                  <span>
                    <UserRound size={19} aria-hidden="true" />
                    <strong>{ROLE_COPY.passenger.title}</strong>
                    <span>{ROLE_COPY.passenger.detail}</span>
                  </span>
                </label>
                <label className="delegate-choice">
                  <input
                    type="radio"
                    name="delegatePreference"
                    value="delegate"
                    defaultChecked={initial.delegatePreference === "delegate"}
                  />
                  <span>
                    <CarFront size={19} aria-hidden="true" />
                    <strong>{ROLE_COPY.delegate.title}</strong>
                    <span>{ROLE_COPY.delegate.detail}</span>
                  </span>
                </label>
              </div>
            </fieldset>
          </>
        )}
        <button
          disabled={busy || !ready}
          aria-describedby="ride-hint"
          className="action action-primary form-submit"
        >
          {busy ? busyLabel : submitLabel}
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </button>
        <p id="ride-hint" className="fine" role="status">
          {onRouteContinue ? (
            "Elige tu partida y destino. Para continuar necesitas crear una cuenta o iniciar sesión."
          ) : !ready && !busy ? (
            "Marca tu partida y destino, y sube una selfie para continuar."
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
