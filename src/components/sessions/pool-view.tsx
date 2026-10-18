"use client";

import { forwardRef, useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CarFront,
  Copy,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import type { Room } from "./room";

export const PoolView = forwardRef<
  HTMLHeadingElement,
  {
    room: Room;
    closed: boolean;
    busy: boolean;
    signedOut: boolean;
    notice: string;
    onMatch: () => void;
    onCopyFailed: () => void;
  }
>(function PoolView(
  { room, closed, busy, signedOut, notice, onMatch, onCopyFailed },
  headingRef,
) {
  const [copied, setCopied] = useState(false);

  // The "copied" confirmation is brief so the button is usable again.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      onCopyFailed();
    }
  }

  const shareUrl = () =>
    `https://wa.me/?text=${encodeURIComponent(
      `Sal conmigo en un taxi compartido con Jala: ${window.location.href}`,
    )}`;

  return (
    <section className="waiting-room" aria-labelledby="waiting-title">
      <header className="room-heading">
        <span className="room-heading-icon">
          <Check size={24} aria-hidden="true" />
        </span>
        <div>
          <h2 id="waiting-title" ref={headingRef} tabIndex={-1}>
            {closed ? "La espera terminó." : "Estás en la sala de espera."}
          </h2>
          <p>
            {closed
              ? "Puedes revisar quiénes estaban esperando o buscar otra sala."
              : "Tu destino quedó guardado. Te agrupamos automáticamente en cuanto llegue alguien compatible."}
          </p>
        </div>
      </header>
      <div className="room-grid">
        <div className="room-main">
          <div className="roster-heading">
            <h3>
              {closed
                ? "Quiénes estaban en la sala"
                : "Quiénes están esperando"}
            </h3>
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
                    ? "Puede reservar el taxi"
                    : "Pasajero"}
                </span>
              </li>
            ))}
          </ul>
          {!room.participants.some(
            (person) => person.delegatePreference === "delegate",
          ) && (
            <p className="delegate-missing">
              <CarFront size={20} aria-hidden="true" />
              Aún falta alguien que pueda reservar el taxi.
            </p>
          )}
          {!closed && (
            <div className="match-action">
              <button
                type="button"
                onClick={onMatch}
                disabled={busy || signedOut}
                className="action action-primary"
              >
                {busy ? "Calculando rutas…" : "Buscar compañeros ahora"}
                {!busy && <ArrowRight size={18} aria-hidden="true" />}
              </button>
              <p className="fine">
                Formamos grupos de viaje de 2 o 3, con alguien que pueda
                reservar y hasta cinco minutos de desvío por persona.
              </p>
            </div>
          )}
          <p role="status" className="wait-note">
            {notice}
          </p>
        </div>
        <aside className="room-side">
          <div className="own-destination">
            <MapPin size={23} aria-hidden="true" />
            <div>
              <span>Tu destino</span>
              <strong>{room.me.destinationLabel}</strong>
            </div>
          </div>
          {!closed && (
            <div className="share-block">
              <h3>Invita a quien salga contigo</h3>
              <div className="share-row">
                <button
                  type="button"
                  onClick={copy}
                  className="action action-secondary"
                >
                  {copied ? (
                    <Check size={18} aria-hidden="true" />
                  ) : (
                    <Copy size={18} aria-hidden="true" />
                  )}
                  {copied ? "Enlace copiado" : "Copiar enlace"}
                </button>
                <a
                  className="action action-secondary"
                  href="https://wa.me/"
                  onClick={(event) => {
                    event.currentTarget.href = shareUrl();
                  }}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={18} aria-hidden="true" />
                  WhatsApp
                  <span className="sr-only"> (se abre en otra pestaña)</span>
                </a>
              </div>
              <span role="status" className="sr-only">
                {copied ? "Enlace copiado" : ""}
              </span>
            </div>
          )}
          <p className="fine">
            <ShieldCheck size={16} aria-hidden="true" />
            La sala ve tu nombre y si puedes reservar. Tu destino solo se
            comparte con tu grupo de viaje.
          </p>
        </aside>
      </div>
    </section>
  );
});
