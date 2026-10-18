"use client";

import { useEffect, useState } from "react";
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

interface Room {
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
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const expired = now >= Date.parse(closesAt);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await sessionApi<Room>(
          `/api/sessions/${sessionId}/waiting-room`,
        );
        if (!stopped) {
          setRoom(result);
          setError("");
        }
      } catch (error) {
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
      await sessionApi("/api/participant", {});
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
          {vehicleCapacity} personas por futuro grupo
        </span>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {closed && (
        <div role="status" className="session-closed">
          <h2>Esta sala ya no admite pasajeros.</h2>
          <p>Puedes volver al evento y elegir otra salida.</p>
          <Link className="action action-secondary" href={`/events/${eventId}`}>
            Volver al evento
          </Link>
        </div>
      )}
      {room ? (
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
          <div className="milestone-note">
            <strong>Por ahora, reunimos a quienes salen.</strong>
            <p>
              El emparejamiento, las rutas y la confirmación de grupos todavía
              no están disponibles. Estar en esta sala no significa tener un
              taxi reservado.
            </p>
          </div>
        </section>
      ) : (
        !closed && (
          <SessionJoinForm onJoin={join} busy={busy} mapCenter={mapCenter} />
        )
      )}
    </div>
  );
}
