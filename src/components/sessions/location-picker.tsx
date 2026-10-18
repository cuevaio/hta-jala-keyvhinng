"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
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
  const [lookup, setLookup] = useState<Lookup>("idle");
  const [results, setResults] = useState<AddressMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const locateRequest = useRef<{ cancelled: boolean } | null>(null);
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
      if (locateRequest.current) {
        locateRequest.current.cancelled = true;
      }
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

  function cancelLocation() {
    if (locateRequest.current) {
      locateRequest.current.cancelled = true;
      locateRequest.current = null;
    }
    setLocating(false);
    setLocationError("");
  }

  function locateOrigin() {
    cancelLocation();
    if (!navigator.geolocation) {
      setLocationError(
        "Tu navegador no permite obtener la ubicación. Escribe tu dirección.",
      );
      return;
    }
    const request = { cancelled: false };
    locateRequest.current = request;
    setLocating(true);
    clearSearch();
    lookupAbort.current?.abort();
    setLookup("idle");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (request.cancelled) return;
        locateRequest.current = null;
        setLocating(false);
        const point = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        labelEdited.current = false;
        lastPoint.current = point;
        onChangeRef.current({
          point,
          label: `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`,
        });
        onFocusPoint(point);
        onActivate();
        resolveLabel(point);
      },
      (error) => {
        if (request.cancelled) return;
        locateRequest.current = null;
        setLocating(false);
        setLocationError(
          error.code === 1
            ? "Permite el acceso a tu ubicación en el navegador o escribe tu dirección."
            : "No pudimos obtener tu ubicación. Intenta otra vez o escribe tu dirección.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
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
    cancelLocation();
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

  const help =
    locationError ||
    (locating
      ? "Obteniendo tu ubicación actual…"
      : searching
        ? "Buscando direcciones…"
        : lookup === "loading"
          ? "Buscando la dirección…"
          : lookup === "failed"
            ? "No encontramos el nombre de ese punto. Escríbelo; el punto se guarda igual."
            : value?.point
              ? ""
              : "Escribe tu dirección y elige una sugerencia.");

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
        <div
          className={
            end === "origin" ? "address-input-with-map" : "address-input"
          }
        >
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
              cancelLocation();
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
          {end === "origin" && (
            <button
              type="button"
              className="address-google-maps"
              disabled={locating}
              onClick={locateOrigin}
              aria-label="Usar mi ubicación actual como punto de partida"
              title="Usar mi ubicación actual"
            >
              <LocateFixed size={22} aria-hidden="true" />
            </button>
          )}
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
