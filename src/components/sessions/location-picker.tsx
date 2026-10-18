"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import {
  reverseGeocode,
  searchAddress,
  type AddressMatch,
} from "@/lib/geocoding";
import type { GeoPoint } from "@/modules/places/domain/place";
import { DestinationMap } from "./destination-map";

export interface PickedLocation {
  /** Null until the person marks the map, searches or shares their position. */
  point: GeoPoint | null;
  label: string;
}

type Lookup = "idle" | "loading" | "failed";
type Locate = "idle" | "locating" | "denied" | "unsupported";

/**
 * One place on the map: current location, address search, map pin and an editable
 * label. The parent owns the value; every way of choosing reports through `onChange`.
 */
export function LocationPicker({
  id,
  legend,
  help,
  value,
  onChange,
  mapCenter,
  pinLabel,
  variant,
  locate = false,
  autoLocate = false,
}: {
  id: string;
  legend: string;
  help?: string;
  value: PickedLocation | null;
  onChange: (next: PickedLocation | null) => void;
  mapCenter: GeoPoint;
  pinLabel: string;
  variant: "origin" | "destination";
  /** Offers "use my location". */
  locate?: boolean;
  /** Asks the browser for the position as soon as the picker appears. */
  autoLocate?: boolean;
}) {
  const [lookup, setLookup] = useState<Lookup>("idle");
  const [locating, setLocating] = useState<Locate>("idle");
  const [focus, setFocus] = useState<GeoPoint | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const labelEdited = useRef(false);
  const lookupAbort = useRef<AbortController | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });
  useEffect(() => () => lookupAbort.current?.abort(), []);

  function resolveLabel(point: GeoPoint) {
    lookupAbort.current?.abort();
    // Never overwrite an address the person typed themselves.
    if (labelEdited.current) return;
    const controller = new AbortController();
    lookupAbort.current = controller;
    setLookup("loading");
    reverseGeocode(point, { signal: controller.signal })
      .then((address) => {
        if (controller.signal.aborted) return;
        if (address)
          onChangeRef.current({
            point: valueRef.current?.point ?? point,
            label: address.slice(0, 200),
          });
        setLookup(address ? "idle" : "failed");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLookup("failed");
      });
  }

  function pick(point: GeoPoint) {
    onChange({ point, label: value?.label ?? "" });
    resolveLabel(point);
  }

  function choose(match: AddressMatch) {
    // The chosen address is the person's own pick, so it replaces any earlier label.
    lookupAbort.current?.abort();
    labelEdited.current = false;
    setLookup("idle");
    onChange({ point: match.point, label: match.label.slice(0, 200) });
    setFocus(match.point);
    setResults(null);
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

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocating("unsupported");
      return;
    }
    setLocating("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        labelEdited.current = false;
        onChangeRef.current({ point, label: valueRef.current?.label ?? "" });
        setFocus(point);
        setLocating("idle");
        resolveLabel(point);
      },
      () => setLocating("denied"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  const autoAsked = useRef(false);
  useEffect(() => {
    if (!autoLocate || autoAsked.current || valueRef.current) return;
    autoAsked.current = true;
    // Deferred so the first paint is not blocked by the permission prompt.
    const timer = setTimeout(useMyLocation, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLocate]);

  function editCoordinate(axis: keyof GeoPoint, raw: string) {
    const number = Number(raw);
    if (raw === "" || !Number.isFinite(number)) return;
    onChange({
      point: {
        latitude: value?.point?.latitude ?? mapCenter.latitude,
        longitude: value?.point?.longitude ?? mapCenter.longitude,
        [axis]: number,
      },
      label: value?.label ?? "",
    });
  }

  return (
    <fieldset className="coordinates-section location-picker">
      <legend>{legend}</legend>
      {help && <p className="input-help">{help}</p>}
      {locate && (
        <div className="locate-row">
          <button
            type="button"
            className="action action-secondary"
            disabled={locating === "locating"}
            onClick={useMyLocation}
          >
            <LocateFixed size={18} aria-hidden="true" />
            {locating === "locating"
              ? "Buscando tu ubicación…"
              : "Usar mi ubicación"}
          </button>
          <p className="input-help" role="status">
            {locating === "denied" &&
              "No pudimos leer tu ubicación. Permite el acceso en tu navegador o búscala abajo."}
            {locating === "unsupported" &&
              "Tu navegador no ofrece ubicación. Búscala abajo o márcala en el mapa."}
          </p>
        </div>
      )}
      <div className="form-section">
        <label htmlFor={`${id}-label`}>Dirección o referencia</label>
        <div className="input-with-icon">
          <MapPin size={19} aria-hidden="true" />
          <input
            id={`${id}-label`}
            className="form-input"
            required
            minLength={3}
            maxLength={200}
            value={value?.label ?? ""}
            onChange={(event) => {
              labelEdited.current = event.target.value !== "";
              onChange({
                point: value?.point ?? null,
                label: event.target.value,
              });
            }}
            placeholder="Se completa al marcar el mapa"
          />
        </div>
        <p className="input-help" role="status">
          {lookup === "loading" && "Buscando la dirección…"}
          {lookup === "failed" &&
            "No encontramos la dirección. Escríbela tú; el punto del mapa se guarda igual."}
        </p>
      </div>
      <div className="address-search" role="search">
        <label htmlFor={`${id}-query`}>Buscar una dirección</label>
        <div className="address-search-row">
          <div className="input-with-icon">
            <Search size={19} aria-hidden="true" />
            <input
              id={`${id}-query`}
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
        O toca el mapa y arrastra el punto para afinarlo.
        <span className="touch-hint">
          {" "}
          En el celular, mueve el mapa con dos dedos.
        </span>
      </p>
      <DestinationMap
        center={value?.point ?? mapCenter}
        value={value?.point ?? null}
        focus={focus}
        onPick={pick}
        label={pinLabel}
        variant={variant}
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
              value={value?.point?.latitude ?? ""}
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
              value={value?.point?.longitude ?? ""}
              onChange={(e) => editCoordinate("longitude", e.target.value)}
              placeholder="-77.0297"
            />
          </label>
        </div>
      </details>
      <p className="input-help" role="status">
        {value?.point
          ? "Punto marcado."
          : "Aún no marcaste este punto en el mapa."}
      </p>
    </fieldset>
  );
}
