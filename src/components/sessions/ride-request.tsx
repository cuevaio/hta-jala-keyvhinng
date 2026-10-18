"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DEFAULT_MAP_CENTER,
  RideForm,
  type RideDraft,
  type RideValues,
} from "./ride-form";
import { clearRideDraft, saveRideDraft, useSavedRideDraft } from "./ride-draft";
import { sessionApi, SessionRequestError } from "./session-api";

const timeFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Plans the ride and hands it to the server, which puts the rider in the best open room
 * for it or opens one (ADR 0010). There is no list of rooms to choose from.
 */
export function RideRequest({
  authenticated,
  initial,
  active,
}: {
  authenticated: boolean;
  initial: RideDraft;
  /** A room the person is already in, so they can resume instead of starting over. */
  active: {
    sessionId: string;
    name: string;
    departsAt: string;
    mine: boolean;
  } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // A route chosen before signing in comes back from this tab's storage, not the URL.
  const saved = useSavedRideDraft();
  const restored = initial.origin || initial.destination ? null : saved;
  const draft = restored ?? initial;

  async function assign(values: RideValues) {
    setBusy(true);
    setError("");
    try {
      const room = await sessionApi<{ id: string }>("/api/groups/assign", {
        selfieDataUrl: values.selfieDataUrl,
        originLabel: values.origin.label,
        originLatitude: values.origin.point.latitude,
        originLongitude: values.origin.point.longitude,
        destinationLabel: values.destination.label,
        latitude: values.destination.point.latitude,
        longitude: values.destination.point.longitude,
        destinationArea: values.destination.area,
        delegatePreference: values.delegatePreference,
        departInMinutes: values.departInMinutes,
      });
      clearRideDraft();
      router.push(`/sessions/${room.id}`);
    } catch (e) {
      if (e instanceof SessionRequestError && e.status === 401) {
        saveRideDraft(values);
        router.push(`/sign-in?next=${encodeURIComponent("/ride")}`);
        return;
      }
      setError(
        e instanceof Error ? e.message : "No pudimos buscarte una sala.",
      );
      setBusy(false);
    }
  }

  return (
    <div>
      {active && (
        <aside className="notice active-group" role="status">
          <div>
            <strong>
              Ya estás en una sala: {active.name}
              {active.mine && <span className="tag room-mine">Mía</span>}
            </strong>
            <span>
              Sale a las {timeFormat.format(new Date(active.departsAt))} (Lima).
              Si buscas otra vez, te dejamos en ella mientras siga sirviendo.
            </span>
          </div>
          <Link
            className="action action-primary"
            href={`/sessions/${active.sessionId}`}
          >
            Volver a mi sala
          </Link>
        </aside>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <RideForm
        key={restored ? "restored" : "initial"}
        onRouteContinue={
          authenticated
            ? undefined
            : (route) => {
                saveRideDraft(route);
                router.push(`/sign-up?next=${encodeURIComponent("/ride")}`);
              }
        }
        initial={draft}
        showTime
        submitLabel={
          authenticated ? "Buscar mi grupo" : "Registrarme para continuar"
        }
        busyLabel="Buscando tu sala…"
        busy={busy}
        mapCenter={
          draft.origin?.point ?? draft.destination?.point ?? DEFAULT_MAP_CENTER
        }
        onSubmit={assign}
      />
    </div>
  );
}
