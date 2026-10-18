"use client";

import { useEffect, useRef, useState, type FormEventHandler } from "react";
import { MapPin, UserRound, CarFront, ShieldCheck } from "lucide-react";
import { reverseGeocode } from "@/lib/geocoding";
import type { GeoPoint } from "@/modules/events/domain/event";
import { DestinationMap } from "./destination-map";

export function SessionJoinForm({
  onJoin,
  busy,
  mapCenter,
  defaultName,
}: {
  onJoin: FormEventHandler<HTMLFormElement>;
  busy: boolean;
  /** Initial map view, usually the event venue. */
  mapCenter: GeoPoint;
  /** Prefills the display name from the signed-in account. */
  defaultName: string;
}) {
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [label, setLabel] = useState("");
  const [lookup, setLookup] = useState<"idle" | "loading" | "failed">("idle");
  const labelEdited = useRef(false);
  const lookupAbort = useRef<AbortController | null>(null);

  useEffect(() => () => lookupAbort.current?.abort(), []);

  function pick(next: GeoPoint) {
    setPoint(next);
    lookupAbort.current?.abort();
    // Never overwrite an address the person typed themselves.
    if (labelEdited.current) return;
    const controller = new AbortController();
    lookupAbort.current = controller;
    setLookup("loading");
    reverseGeocode(next, { signal: controller.signal })
      .then((address) => {
        if (controller.signal.aborted) return;
        if (address) setLabel(address.slice(0, 200));
        setLookup(address ? "idle" : "failed");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLookup("failed");
      });
  }

  function editCoordinate(axis: keyof GeoPoint, raw: string) {
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) return;
    setPoint((current) => ({
      latitude: current?.latitude ?? mapCenter.latitude,
      longitude: current?.longitude ?? mapCenter.longitude,
      [axis]: value,
    }));
  }

  return (
    <form onSubmit={onJoin} className="join-form">
      <header className="form-heading">
        <h2>¿A dónde vas?</h2>
        <p>Cada persona conserva su destino. Empieza por el tuyo.</p>
      </header>
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
            placeholder="Tu nombre para la sala"
          />
        </div>
        <p className="input-help">Las otras personas verán este nombre.</p>
      </div>
      <div className="form-section">
        <label htmlFor="destination">Tu destino exacto</label>
        <div className="input-with-icon">
          <MapPin size={19} aria-hidden="true" />
          <input
            id="destination"
            className="form-input"
            name="destinationLabel"
            required
            minLength={3}
            maxLength={200}
            value={label}
            onChange={(event) => {
              labelEdited.current = event.target.value !== "";
              setLabel(event.target.value);
            }}
            placeholder="Dirección o referencia de llegada"
          />
        </div>
        <p className="input-help" role="status">
          {lookup === "loading" && "Buscando la dirección…"}
          {lookup === "failed" &&
            "No encontramos la dirección. Escríbela tú; el punto del mapa se guarda igual."}
          {lookup === "idle" &&
            "Se completa al marcar el mapa. Puedes corregirla."}
        </p>
      </div>
      <fieldset className="coordinates-section">
        <legend>Ubicación del destino</legend>
        <p className="input-help">
          Toca el mapa para marcar dónde te dejan. Arrastra el punto para
          afinarlo.
        </p>
        <DestinationMap center={mapCenter} value={point} onPick={pick} />
        <details className="coordinates-manual">
          <summary>Prefiero escribir las coordenadas</summary>
          <div className="coordinate-fields">
            <label>
              Latitud
              <input
                className="form-input"
                type="number"
                step="any"
                min={-90}
                max={90}
                name="latitude"
                required
                value={point?.latitude ?? ""}
                onChange={(e) => editCoordinate("latitude", e.target.value)}
                placeholder="-12.1219"
              />
            </label>
            <label>
              Longitud
              <input
                className="form-input"
                type="number"
                step="any"
                min={-180}
                max={180}
                name="longitude"
                required
                value={point?.longitude ?? ""}
                onChange={(e) => editCoordinate("longitude", e.target.value)}
                placeholder="-77.0297"
              />
            </label>
          </div>
        </details>
        <p className="input-help" role="status">
          {point ? "Punto marcado." : "Aún no marcaste tu destino en el mapa."}
        </p>
      </fieldset>
      <fieldset className="delegate-section">
        <legend>¿Puedes reservar el taxi?</legend>
        <p className="input-help">
          Una persona del futuro grupo lo reservará en una app externa.
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
          Tu dirección solo se muestra en tu vista de la sala. Esta demo no
          verifica identidades ni realiza cobros.
        </span>
      </p>
      <button
        disabled={busy || !point}
        className="action action-primary form-submit"
      >
        {busy ? "Guardando tu destino…" : "Unirme a la sala"}
      </button>
    </form>
  );
}
