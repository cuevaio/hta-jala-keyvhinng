"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, MapPinned } from "lucide-react";
import {
  reverseGeocode,
  searchAddress,
  type AddressMatch,
} from "@/lib/geocoding";
import type { GeoPoint } from "@/modules/places/domain/place";
import type { RideEnd } from "./ride-map";

export interface PickedLocation {
  /** Null until the person marks the map, searches or shares their position. */
  point: GeoPoint | null;
  label: string;
}

type Lookup = "idle" | "loading" | "failed";

const COPY: Record<
  RideEnd,
  { label: string; placeholder: string; results: string }
> = {
  origin: {
    label: "Punto de partida",
    placeholder: "¿Desde dónde sales?",
    results: "Resultados del punto de partida",
  },
  destination: {
    label: "¿A dónde vas?",
    placeholder: "Distrito, calle o lugar",
    results: "Resultados del destino",
  },
};

/**
 * One address field per end of the ride: search and map picks
 * share its label. The parent owns the value and the map; every way of choosing
 * reports through `onChange`, and `onFocusPoint` asks the map to look there.
 */
export function LocationPicker({
  id,
  end,
  value,
  onChange,
  onActivate,
  onFocusPoint,
}: {
  id: string;
  end: RideEnd;
  value: PickedLocation | null;
  onChange: (next: PickedLocation | null) => void;
  /** The person is working on this field, so map taps should place this pin. */
  onActivate: () => void;
  onFocusPoint: (point: GeoPoint) => void;
}) {
  const copy = COPY[end];
  const mapsQuery = value?.point
    ? `${value.point.latitude},${value.point.longitude}`
    : value?.label.trim();
  const mapsHref = mapsQuery
    ? `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: mapsQuery })}`
    : "https://www.google.com/maps";
  const [lookup, setLookup] = useState<Lookup>("idle");
  const [results, setResults] = useState<AddressMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const labelEdited = useRef(false);
  const lookupAbort = useRef<AbortController | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });
  useEffect(
    () => () => {
      lookupAbort.current?.abort();
      searchAbort.current?.abort();
    },
    [],
  );

  // A pin placed on the map arrives as a new point with the old label: name it.
  const lastPoint = useRef(value?.point ?? null);
  useEffect(() => {
    const point = value?.point ?? null;
    if (point && point !== lastPoint.current) {
      clearSearch();
      resolveLabel(point);
    }
    lastPoint.current = point;
  }, [value?.point]);

  function clearSearch() {
    searchAbort.current?.abort();
    setSearching(false);
    setResults(null);
  }

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

  function choose(match: AddressMatch) {
    // The chosen address is the person's own pick, so it replaces any earlier label.
    lookupAbort.current?.abort();
    labelEdited.current = false;
    setLookup("idle");
    lastPoint.current = match.point;
    onChange({ point: match.point, label: match.label.slice(0, 200) });
    onFocusPoint(match.point);
    clearSearch();
  }

  async function search() {
    const text = valueRef.current?.label.trim() ?? "";
    if (text.length < 3) return;
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setSearching(true);
    try {
      const matches = await searchAddress(text, { signal: controller.signal });
      if (!controller.signal.aborted) setResults(matches);
    } catch {
      if (!controller.signal.aborted) setResults([]);
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }

  useEffect(() => {
    if (value?.point || (value?.label.trim().length ?? 0) < 3) return;
    const timer = setTimeout(() => void search(), 500);
    return () => {
      clearTimeout(timer);
      searchAbort.current?.abort();
    };
    // Search after typing pauses; callbacks and the current value are read through refs.
  }, [value?.label, value?.point]);

  const help = searching
    ? "Buscando direcciones…"
    : lookup === "loading"
      ? "Buscando la dirección…"
      : lookup === "failed"
        ? "No encontramos el nombre de ese punto. Escríbelo; el punto se guarda igual."
        : value?.point
          ? ""
          : "Escribe tu dirección y elige una sugerencia.";

  return (
    <div className={`location-field location-field-${end}`}>
      <div className="location-field-head">
        <label htmlFor={`${id}-label`}>
          {end === "origin" ? (
            <span className="dot" aria-hidden="true" />
          ) : (
            <MapPin size={14} aria-hidden="true" />
          )}
          {copy.label}
        </label>
      </div>
      <div className="address-search-row">
        <div className="address-input-with-map">
          <input
            id={`${id}-label`}
            className="form-input"
            required
            minLength={3}
            maxLength={200}
            enterKeyHint="search"
            aria-describedby={`${id}-address-help`}
            value={value?.label ?? ""}
            onFocus={onActivate}
            onChange={(event) => {
              lookupAbort.current?.abort();
              clearSearch();
              setLookup("idle");
              labelEdited.current = event.target.value !== "";
              onChange({ point: null, label: event.target.value });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
            placeholder={copy.placeholder}
          />
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="address-google-maps"
            aria-label={`Abrir ${end === "origin" ? "punto de partida" : "destino"} en Google Maps (se abre en otra pestaña)`}
            title="Abrir en Google Maps"
          >
            <MapPinned size={22} aria-hidden="true" />
          </a>
        </div>
      </div>
      <p id={`${id}-address-help`} className="input-help" role="status">
        {help}
      </p>
      {results && (
        <ul className="address-results" aria-label={copy.results}>
          {results.length === 0 && (
            <li className="input-help" role="status">
              No encontramos esa dirección. Prueba con otra.
            </li>
          )}
          {results.map((match) => (
            <li key={`${match.point.latitude},${match.point.longitude}`}>
              <button type="button" onClick={() => choose(match)}>
                {match.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
