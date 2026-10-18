"use client";

import { useEffect, useRef, useState, type FormEventHandler } from "react";
import { MapPin, Search, UserRound, CarFront, ShieldCheck } from "lucide-react";
import {
  reverseGeocode,
  searchAddress,
  type AddressMatch,
} from "@/lib/geocoding";
import type { GeoPoint } from "@/modules/places/domain/place";
import { DestinationMap } from "./destination-map";

export function SessionJoinForm({
  onJoin,
  busy,
  mapCenter,
  defaultName,
}: {
  onJoin: FormEventHandler<HTMLFormElement>;
  busy: boolean;
  /** Initial map view, usually the place. */
  mapCenter: GeoPoint;
  /** Prefills the display name from the signed-in account. */
  defaultName: string;
}) {
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [label, setLabel] = useState("");
  const [lookup, setLookup] = useState<"idle" | "loading" | "failed">("idle");
  const [focus, setFocus] = useState<GeoPoint | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
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

  async function search() {
    const text = query.trim();
    if (text.length < 3) return;
    setSearching(true);
    try {
      setResults(await searchAddress(text));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function choose(match: AddressMatch) {
    // The chosen address is the person's own pick, so it replaces any earlier label.
    lookupAbort.current?.abort();
    labelEdited.current = false;
    setLabel(match.label.slice(0, 200));
    setLookup("idle");
    setPoint(match.point);
    setFocus(match.point);
    setResults(null);
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
        <div className="address-search" role="search">
          <label htmlFor="address-query">Buscar una dirección</label>
          <div className="address-search-row">
            <div className="input-with-icon">
              <Search size={19} aria-hidden="true" />
              <input
                id="address-query"
                className="form-input"
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void search();
                  }
                }}
                placeholder="Ej. Av. Larco 345, Miraflores"
              />
            </div>
            <button
              type="button"
              className="action action-secondary"
              disabled={searching || query.trim().length < 3}
              onClick={() => void search()}
            >
              {searching ? "Buscando…" : "Buscar"}
            </button>
          </div>
          {results && (
            <ul
              className="address-results"
              role="listbox"
              aria-label="Resultados"
            >
              {results.length === 0 && (
                <li className="input-help" role="status">
                  No encontramos esa dirección. Prueba con otra o marca el mapa.
                </li>
              )}
              {results.map((match) => (
                <li key={`${match.point.latitude},${match.point.longitude}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => choose(match)}
                  >
                    {match.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="input-help">
          O toca el mapa para marcar dónde te dejan y arrastra el punto para
          afinarlo.
          <span className="touch-hint">
            {" "}
            En el celular, mueve el mapa con dos dedos.
          </span>
        </p>
        <DestinationMap
          center={mapCenter}
          value={point}
          focus={focus}
          onPick={pick}
        />
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
        aria-describedby="join-hint"
        className="action action-primary form-submit"
      >
        {busy ? "Guardando tu destino…" : "Unirme a la sala"}
      </button>
      <p id="join-hint" className="input-help" role="status">
        {!point && !busy
          ? "Marca tu destino en el mapa o búscalo por dirección para continuar."
          : ""}
      </p>
    </form>
  );
}
