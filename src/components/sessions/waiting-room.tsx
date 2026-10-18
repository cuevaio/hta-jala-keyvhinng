"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Clock3,
  MapPin,
  Users,
  Copy,
  Check,
  CarFront,
  ShieldCheck,
} from "lucide-react";
import type { GeoPoint } from "@/modules/events/domain/event";
import { SessionJoinForm } from "./session-join-form";
import { sessionApi, SessionRequestError } from "./session-api";

import type { MatchingRoutePlan } from "@/modules/matching/domain/route-plan";
import type { PartyCommand } from "@/modules/parties/domain/party-lifecycle";
import { apportionMinor } from "@/modules/payments/domain/fare-allocation";

interface Room {
  party: {
    id: string;
    status: "forming" | "confirmed" | "in_progress" | "completed" | "cancelled";
    plan: MatchingRoutePlan | null;
    members: { participantId: string; status: string }[];
  } | null;
  me: {
    id: string;
    destinationLabel: string;
    latitude: number;
    longitude: number;
    delegatePreference: "delegate" | "passenger";
  };
  participants: {
    id: string;
    displayName: string;
    delegatePreference: "delegate" | "passenger";
    status: string;
  }[];
  acceptingJoins: boolean;
}

const PARTY_TITLES = {
  forming: "Encontramos tu grupo.",
  confirmed: "Grupo confirmado.",
  in_progress: "Viaje en curso.",
  completed: "Viaje completado.",
  cancelled: "Grupo cancelado.",
} as const;
const PARTY_HINTS = {
  forming: "Revisa la ruta y confirma tu lugar. El taxi aún no está reservado.",
  confirmed: "Todos confirmaron. Quien reserva el taxi inicia el viaje.",
  in_progress: "Buen viaje. Quien reserva el taxi lo finaliza al llegar.",
  completed: "Gracias por compartir el viaje.",
  cancelled: "Este grupo ya no está activo.",
} as const;

/** "45.5" or "45,50" → 4550 céntimos; null when empty or not a plain amount. */
function parseFareMinor(value: string): number | null {
  const match = /^(\d{1,5})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export function WaitingRoom({
  sessionId,
  eventId,
  closesAt,
  initiallyOpen,
  vehicleCapacity,
  mapCenter,
}: {
  sessionId: string;
  eventId: string;
  closesAt: string;
  initiallyOpen: boolean;
  vehicleCapacity: number;
  mapCenter: GeoPoint;
}) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [matchNotice, setMatchNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [fareInput, setFareInput] = useState("");
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [left, setLeft] = useState(false);
  const hadParty = useRef(false);
  const expired = now >= Date.parse(closesAt);

  useEffect(() => {
    sessionApi<{ displayName: string } | null>("/api/auth/me")
      .then((me) => setAccountName(me?.displayName ?? ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await sessionApi<Room>(
          `/api/sessions/${sessionId}/waiting-room`,
        );
        if (!stopped) {
          if (hadParty.current && !result.party)
            setMatchNotice(
              "Tu grupo se deshizo porque alguien salió. Busca otro grupo cuando quieras.",
            );
          hadParty.current = result.party !== null;
          setRoom(result);
          setSignedOut(false);
          setError("");
        }
      } catch (error) {
        if (error instanceof SessionRequestError && error.status === 401) {
          if (!stopped) {
            setSignedOut(true);
            setRoom(null);
          }
        }
        if (
          !stopped &&
          !(
            error instanceof SessionRequestError &&
            (error.status === 401 || error.status === 403)
          )
        ) {
          setError(
            "No pudimos actualizar la sala. Reintentaremos automáticamente.",
          );
        }
      } finally {
        if (!stopped) {
          setLoading(false);
          setNow(Date.now());
          timer = setTimeout(poll, 4000);
        }
      }
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [sessionId]);

  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await sessionApi(`/api/sessions/${sessionId}/join`, {
        displayName: data.get("displayName"),
        destinationLabel: data.get("destinationLabel"),
        latitude: Number(data.get("latitude")),
        longitude: Number(data.get("longitude")),
        delegatePreference: data.get("delegatePreference"),
      });
      setRoom(
        await sessionApi<Room>(`/api/sessions/${sessionId}/waiting-room`),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar tu destino.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function match() {
    setBusy(true);
    setError("");
    setMatchNotice("");
    try {
      await sessionApi(`/api/sessions/${sessionId}/match`, {});
      const result = await sessionApi<Room>(
        `/api/sessions/${sessionId}/waiting-room`,
      );
      setRoom(result);
      if (!result.party)
        setMatchNotice(
          "Aún no encontramos un grupo compatible para ti. Sigues en la sala; puedes intentar cuando lleguen más personas.",
        );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "No pudimos buscar tu grupo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function partyAction(action: PartyCommand) {
    setBusy(true);
    setError("");
    try {
      await sessionApi(`/api/sessions/${sessionId}/party`, { action });
      if (action === "leave") {
        hadParty.current = false;
        setLeft(true);
        setRoom(null);
        return;
      }
      setRoom(
        await sessionApi<Room>(`/api/sessions/${sessionId}/waiting-room`),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No pudimos completar la acción.",
      );
    } finally {
      setConfirmingLeave(false);
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setError(
        "Copia la dirección de esta página desde tu navegador para compartirla.",
      );
    }
  }

  if (loading)
    return (
      <div className="room-loading" role="status">
        <Users size={30} aria-hidden="true" />
        <p>Cargando tu sala…</p>
      </div>
    );
  if (signedOut && !room)
    return (
      <div className="session-closed" role="status">
        <h2>Inicia sesión para unirte.</h2>
        <p>Necesitas una cuenta para guardar tu destino en la sala.</p>
        <Link
          className="action action-primary"
          href={`/sign-in?next=${encodeURIComponent(`/sessions/${sessionId}`)}`}
        >
          Iniciar sesión
        </Link>
        <Link
          className="action action-secondary"
          href={`/sign-up?next=${encodeURIComponent(`/sessions/${sessionId}`)}`}
        >
          Crear cuenta
        </Link>
      </div>
    );
  if (left)
    return (
      <div className="session-closed" role="status">
        <h2>Saliste del grupo.</h2>
        <p>
          El grupo se deshizo para recalcular rutas y reparto con quienes
          quedan. Puedes volver al evento y elegir otra salida.
        </p>
        <Link className="action action-secondary" href={`/events/${eventId}`}>
          Volver al evento
        </Link>
      </div>
    );
  const confirmedIds = new Set(
    room?.party?.members
      .filter((m) => m.status === "confirmed")
      .map((m) => m.participantId),
  );
  const closed =
    expired || !initiallyOpen || (room !== null && !room.acceptingJoins);
  return (
    <div className="session-content">
      <div className="session-meta">
        <span>
          <Clock3 size={17} aria-hidden="true" />
          Hasta{" "}
          {new Date(closesAt).toLocaleString("es-PE", {
            timeZone: "America/Lima",
            hour: "2-digit",
            minute: "2-digit",
            day: "numeric",
            month: "short",
          })}{" "}
          (Lima)
        </span>
        <span>
          <Users size={17} aria-hidden="true" />
          Hasta {Math.min(vehicleCapacity, 3)} personas por grupo
        </span>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {closed && !room?.party && (
        <div role="status" className="session-closed">
          <h2>Esta sala ya no admite pasajeros.</h2>
          <p>Puedes volver al evento y elegir otra salida.</p>
          <Link className="action action-secondary" href={`/events/${eventId}`}>
            Volver al evento
          </Link>
        </div>
      )}
      {room?.party?.plan ? (
        <section className="waiting-room" aria-labelledby="matched-title">
          <header className="room-heading">
            <span className="room-heading-icon">
              <CarFront size={24} aria-hidden="true" />
            </span>
            <div>
              <h2 id="matched-title">{PARTY_TITLES[room.party.status]}</h2>
              <p>{PARTY_HINTS[room.party.status]}</p>
            </div>
          </header>
          <div className="own-destination">
            <MapPin size={23} aria-hidden="true" />
            <div>
              <span>Punto de encuentro</span>
              <strong>{room.party.plan.origin.label}</strong>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${room.party.plan.origin.latitude},${room.party.plan.origin.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver punto de encuentro
              </a>
            </div>
          </div>
          <h3>Ruta y reparto recomendado</h3>
          <ol className="roster">
            {room.party.plan.stops.map((stop) => (
              <li key={stop.participantId}>
                <span className="person-avatar" aria-hidden="true">
                  {stop.dropOffOrder}
                </span>
                <div className="person-name">
                  <strong>
                    {stop.displayName}
                    {stop.participantId === room.me.id ? " (Tú)" : ""}
                    {confirmedIds.has(stop.participantId) && (
                      <Check
                        size={16}
                        aria-label="Confirmó"
                        className="inline-icon"
                      />
                    )}
                  </strong>
                  <span>{stop.destinationLabel}</span>
                  <span>
                    {stop.role === "delegate" ? "Reserva el taxi" : "Pasajero"}{" "}
                    · {Math.ceil(stop.arrivalSeconds / 60)} min desde el
                    encuentro · +{Math.ceil(stop.detourSeconds / 60)} min de
                    desvío
                  </span>
                </div>
                <span className="person-role">
                  {(stop.fareShareBps / 100).toLocaleString("es-PE", {
                    maximumFractionDigits: 2,
                  })}
                  %
                </span>
              </li>
            ))}
          </ol>
          <p className="privacy-note">
            Las direcciones de esta propuesta solo se comparten con tu grupo.
          </p>
          {(() => {
            const party = room.party;
            const mine = party.members.find(
              (m) => m.participantId === room.me.id,
            );
            const isDelegate =
              party.plan!.stops.find((x) => x.participantId === room.me.id)
                ?.role === "delegate";
            const pending = party.members.filter(
              (m) => m.status !== "confirmed",
            ).length;
            const fareMinor = parseFareMinor(fareInput);
            const split =
              fareMinor === null
                ? null
                : apportionMinor(
                    fareMinor,
                    party.plan!.stops.map((x) => x.fareShareBps),
                  );
            return (
              <>
                <label className="fare-calculator">
                  <span>Tarifa del taxi (S/), si ya la conocen</span>
                  <input
                    inputMode="decimal"
                    value={fareInput}
                    onChange={(e) => setFareInput(e.target.value)}
                    placeholder="Ej. 45.00"
                  />
                </label>
                {split && (
                  <ul className="roster" aria-label="Reparto en soles">
                    {party.plan!.stops.map((stop, i) => (
                      <li key={stop.participantId}>
                        <div className="person-name">
                          <strong>{stop.displayName}</strong>
                        </div>
                        <span className="person-role">
                          S/ {(split[i] / 100).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {party.status === "forming" && mine?.status !== "confirmed" && (
                  <button
                    type="button"
                    className="action action-primary"
                    disabled={busy}
                    onClick={() => partyAction("confirm")}
                  >
                    Confirmo mi lugar y el reparto
                  </button>
                )}
                {party.status === "forming" && mine?.status === "confirmed" && (
                  <p role="status">
                    Esperando la confirmación de {pending}{" "}
                    {pending === 1 ? "persona" : "personas"} más.
                  </p>
                )}
                {isDelegate && party.status === "confirmed" && (
                  <button
                    type="button"
                    className="action action-primary"
                    disabled={busy}
                    onClick={() => partyAction("start")}
                  >
                    Salimos: iniciar viaje
                  </button>
                )}
                {isDelegate && party.status === "in_progress" && (
                  <button
                    type="button"
                    className="action action-primary"
                    disabled={busy}
                    onClick={() => partyAction("complete")}
                  >
                    Llegamos: finalizar viaje
                  </button>
                )}
                {(party.status === "forming" || party.status === "confirmed") &&
                  (confirmingLeave ? (
                    <div className="milestone-note">
                      <strong>¿Salir del grupo?</strong>
                      <p>
                        El grupo se deshace y los demás vuelven a la sala para
                        recalcular la ruta. Tendrás que unirte de nuevo.
                      </p>
                      <button
                        type="button"
                        className="action action-secondary"
                        disabled={busy}
                        onClick={() => partyAction("leave")}
                      >
                        Sí, salir
                      </button>
                      <button
                        type="button"
                        className="action action-secondary"
                        onClick={() => setConfirmingLeave(false)}
                      >
                        Quedarme
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="action action-secondary"
                      onClick={() => setConfirmingLeave(true)}
                    >
                      Salir del grupo
                    </button>
                  ))}
              </>
            );
          })()}
          <div className="milestone-note">
            <strong>Jala no reserva ni cobra el taxi.</strong>
            <p>
              La persona indicada reserva el taxi fuera de Jala. El reparto se
              calcula por distancia recorrida y suma 100%; no es una tarifa del
              proveedor. Todos deben confirmar antes de salir.
            </p>
          </div>
        </section>
      ) : room ? (
        <section className="waiting-room" aria-labelledby="waiting-title">
          <header className="room-heading">
            <span className="room-heading-icon">
              <Check size={24} aria-hidden="true" />
            </span>
            <div>
              <h2 id="waiting-title">Ya estás en la sala.</h2>
              <p>
                Tu destino quedó guardado. Comparte el enlace para reunir a más
                personas.
              </p>
            </div>
          </header>
          <div className="own-destination">
            <MapPin size={23} aria-hidden="true" />
            <div>
              <span>Tu destino</span>
              <strong>{room.me.destinationLabel}</strong>
            </div>
          </div>
          <div className="roster-heading">
            <h3>Quiénes están esperando</h3>
            <span role="status" className="roster-count">
              {room.participants.length}{" "}
              {room.participants.length === 1 ? "persona" : "personas"}
            </span>
          </div>
          <ul className="roster">
            {room.participants.map((person) => (
              <li key={person.id}>
                <span
                  className={`person-avatar ${person.delegatePreference === "delegate" ? "person-delegate" : ""}`}
                  aria-hidden="true"
                >
                  {person.displayName
                    .trim()
                    .slice(0, 1)
                    .toLocaleUpperCase("es")}
                </span>
                <div className="person-name">
                  <strong>{person.displayName}</strong>
                  {person.id === room.me.id && <span>Tú</span>}
                </div>
                <span className="person-role">
                  {person.delegatePreference === "delegate" && (
                    <CarFront size={17} aria-hidden="true" />
                  )}
                  {person.delegatePreference === "delegate"
                    ? "Puede reservar"
                    : "Pasajero"}
                </span>
              </li>
            ))}
          </ul>
          <p className="roster-refresh">
            La sala se actualiza automáticamente cada 4 segundos.
          </p>
          {!room.participants.some(
            (person) => person.delegatePreference === "delegate",
          ) && (
            <p className="delegate-missing">
              <CarFront size={20} aria-hidden="true" />
              Aún falta alguien que pueda reservar el taxi.
            </p>
          )}
          <button
            type="button"
            onClick={copy}
            className="action action-secondary share-button"
          >
            {copied ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <Copy size={18} aria-hidden="true" />
            )}
            {copied ? "Enlace copiado" : "Copiar enlace de la sala"}
          </button>
          <span role="status" className="sr-only">
            {copied ? "Enlace copiado" : ""}
          </span>
          <p className="privacy-note">
            <ShieldCheck size={19} aria-hidden="true" />
            <span>
              Las otras personas ven tu nombre y si puedes reservar. Tu
              dirección exacta permanece privada.
            </span>
          </p>
          {!closed && (
            <button
              type="button"
              onClick={match}
              disabled={busy || signedOut}
              className="action action-primary"
            >
              {busy ? "Calculando rutas…" : "Buscar mi grupo"}
            </button>
          )}
          <p role="status">{matchNotice}</p>
          <div className="milestone-note">
            <strong>Un grupo compatible para compartir el taxi.</strong>
            <p>
              Buscamos grupos de dos o tres con alguien que pueda reservar y un
              desvío máximo de cinco minutos por persona. Al encontrar un grupo,
              compartimos los destinos exactos solo entre sus integrantes. Jala
              no reserva el taxi.
            </p>
          </div>
        </section>
      ) : (
        !closed && (
          <SessionJoinForm
            onJoin={join}
            busy={busy}
            mapCenter={mapCenter}
            defaultName={accountName}
          />
        )
      )}
    </div>
  );
}
