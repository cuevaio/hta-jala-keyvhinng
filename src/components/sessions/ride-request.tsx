"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, MapPin, Navigation, Users } from "lucide-react";
import type { GroupMatch } from "@/modules/sessions/infrastructure/participation.repository";
import {
  DEFAULT_MAP_CENTER,
  RideForm,
  type RideDraft,
  type RideValues,
} from "./ride-form";
import { sessionApi, SessionRequestError } from "./session-api";

/** Group as the search endpoint returns it (dates are ISO strings). */
type FoundGroup = Omit<GroupMatch, "departsAt"> & { departsAt: string };

const timeFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  hour: "2-digit",
  minute: "2-digit",
});

const distance = (meters: number) =>
  meters < 950
    ? `${Math.round(meters / 50) * 50} m`
    : `${(meters / 1000).toFixed(1)} km`;

const shortLabel = (label: string) => label.split(",")[0];

/** The draft as a URL, so signing in mid-request brings the person back to it. */
export function draftQuery(values: RideValues) {
  return new URLSearchParams({
    olat: String(values.origin.point.latitude),
    olng: String(values.origin.point.longitude),
    olabel: values.origin.label,
    dlat: String(values.destination.point.latitude),
    dlng: String(values.destination.point.longitude),
    dlabel: values.destination.label,
    when: String(values.departInMinutes),
  }).toString();
}

export function RideRequest({
  initial,
  defaultName,
  active,
}: {
  initial: RideDraft;
  defaultName: string;
  /** A group the person is already in, so they can resume instead of starting over. */
  active: { sessionId: string; name: string; departsAt: string } | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<RideValues | null>(null);
  const [groups, setGroups] = useState<FoundGroup[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Going back to edit keeps what was typed, not the URL the page loaded with.
  const draft: RideDraft = values
    ? {
        origin: values.origin,
        destination: values.destination,
        departInMinutes: values.departInMinutes,
      }
    : initial;

  async function search(next: RideValues) {
    setBusy(true);
    setError("");
    try {
      const query = new URLSearchParams({
        olat: String(next.origin.point.latitude),
        olng: String(next.origin.point.longitude),
        dlat: String(next.destination.point.latitude),
        dlng: String(next.destination.point.longitude),
        depart: String(next.departInMinutes),
      });
      setGroups(await sessionApi<FoundGroup[]>(`/api/groups/search?${query}`));
      setValues(next);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos buscar grupos ahora.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function commit(path: string, body: unknown, current: RideValues) {
    setBusy(true);
    setError("");
    try {
      const session = await sessionApi<{ id: string }>(path, body);
      router.push(`/sessions/${session.id}`);
    } catch (e) {
      if (e instanceof SessionRequestError && e.status === 401) {
        const next = `/ride?${draftQuery(current)}`;
        router.push(`/sign-in?next=${encodeURIComponent(next)}`);
        return;
      }
      setError(e instanceof Error ? e.message : "No pudimos unirte al grupo.");
      setBusy(false);
    }
  }

  const payload = (v: RideValues) => ({
    displayName: v.displayName,
    originLabel: v.origin.label,
    originLatitude: v.origin.point.latitude,
    originLongitude: v.origin.point.longitude,
    destinationLabel: v.destination.label,
    latitude: v.destination.point.latitude,
    longitude: v.destination.point.longitude,
    delegatePreference: v.delegatePreference,
  });

  if (values && groups) {
    return (
      <section className="ride-results" aria-labelledby="ride-results-title">
        <header className="form-heading">
          <h2 id="ride-results-title" tabIndex={-1}>
            {groups.length === 0
              ? "Aún no hay grupos para tu ruta."
              : groups.length === 1
                ? "Encontramos 1 grupo para tu ruta."
                : `Encontramos ${groups.length} grupos para tu ruta.`}
          </h2>
          <p className="ride-route-summary">
            <MapPin size={17} aria-hidden="true" />
            {shortLabel(values.origin.label)}
            <ArrowRight size={15} aria-hidden="true" />
            {shortLabel(values.destination.label)}
            <span>
              ·{" "}
              {values.departInMinutes === 0
                ? "ahora"
                : `en ${values.departInMinutes} min`}
            </span>
          </p>
        </header>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {groups.length > 0 && (
          <ul className="group-list">
            {groups.map((group) => (
              <li key={group.id} className="group-card">
                <div className="group-card-head">
                  <h3>{group.name}</h3>
                  <span className="group-count">
                    <Users size={16} aria-hidden="true" />
                    {group.waitingCount}{" "}
                    {group.waitingCount === 1 ? "persona" : "personas"}
                  </span>
                </div>
                <dl className="group-facts">
                  <div>
                    <dt>
                      <Navigation size={15} aria-hidden="true" /> Sale de
                    </dt>
                    <dd>
                      {group.pickupLabel}
                      <small>
                        a {distance(group.affinity.pickupMeters)} de ti
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <MapPin size={15} aria-hidden="true" /> Va hacia
                    </dt>
                    <dd>
                      {shortLabel(group.destinationLabel)}
                      <small>
                        a {distance(group.affinity.destinationMeters)} de tu
                        destino
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <Clock3 size={15} aria-hidden="true" /> Sale
                    </dt>
                    <dd>
                      {timeFormat.format(new Date(group.departsAt))}
                      <small>hora de Lima</small>
                    </dd>
                  </div>
                </dl>
                <button
                  className="action action-primary"
                  disabled={busy}
                  onClick={() =>
                    commit(
                      `/api/sessions/${group.id}/join`,
                      payload(values),
                      values,
                    )
                  }
                >
                  {busy ? "Uniéndote…" : "Unirme a este grupo"}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="ride-create">
          <p>
            {groups.length === 0
              ? "Crea el primero: otras personas con tu ruta podrán unirse."
              : "¿Ninguno te sirve? Empieza uno con tu ruta."}
          </p>
          <button
            className={`action ${groups.length === 0 ? "action-primary" : "action-secondary"}`}
            disabled={busy}
            onClick={() =>
              commit(
                "/api/groups",
                { ...payload(values), departInMinutes: values.departInMinutes },
                values,
              )
            }
          >
            {busy ? "Creando…" : "Crear un grupo nuevo"}
          </button>
          <button
            className="action action-link"
            disabled={busy}
            onClick={() => {
              setGroups(null);
              setError("");
            }}
          >
            Cambiar mi ruta
          </button>
        </div>
      </section>
    );
  }

  return (
    <div>
      {active && (
        <aside className="active-group" role="status">
          <div>
            <strong>Ya estás en un grupo: {active.name}</strong>
            <span>
              Sale a las {timeFormat.format(new Date(active.departsAt))} (Lima).
              Termínalo o sal de él antes de unirte a otro.
            </span>
          </div>
          <Link
            className="action action-primary"
            href={`/sessions/${active.sessionId}`}
          >
            Volver a mi grupo
          </Link>
        </aside>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <RideForm
        initial={draft}
        defaultName={values?.displayName ?? defaultName}
        showTime
        submitLabel="Buscar grupos"
        busyLabel="Buscando grupos…"
        busy={busy}
        originMapCenter={draft.origin?.point ?? DEFAULT_MAP_CENTER}
        destinationMapCenter={
          draft.destination?.point ?? draft.origin?.point ?? DEFAULT_MAP_CENTER
        }
        autoLocate={draft.origin === null}
        onSubmit={search}
      />
    </div>
  );
}
