"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Check, CarFront, ExternalLink, MapPin } from "lucide-react";
import type { PartyCommand } from "@/modules/parties/domain/party-lifecycle";
import { apportionMinor } from "@/modules/payments/domain/fare-allocation";
import { formatSoles } from "@/modules/payments/domain/fees";
import { PartyChat } from "./party-chat";
import type { Room, PartyStatus } from "./room";
import { RouteMap } from "./route-map";

const TITLES: Record<PartyStatus, string> = {
  forming: "Encontramos tu grupo de viaje.",
  confirmed: "Grupo de viaje confirmado.",
  in_progress: "Viaje en curso.",
  completed: "Viaje completado.",
  cancelled: "Grupo de viaje cancelado.",
};
const HINTS: Record<PartyStatus, string> = {
  forming: "Revisa la ruta y confirma tu lugar. El taxi aún no está reservado.",
  confirmed: "Todos confirmaron. Quien reserva el taxi inicia el viaje.",
  in_progress: "Buen viaje. Quien reserva el taxi lo finaliza al llegar.",
  completed: "Gracias por compartir el viaje.",
  cancelled: "Este grupo de viaje ya no está activo.",
};

/** "45.5" or "45,50" → 4550 céntimos; null when empty or not a plain amount. */
export function parseFareMinor(value: string): number | null {
  const match = /^(\d{1,5})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}
const percent = (bps: number) =>
  `${(bps / 100).toLocaleString("es-PE", { maximumFractionDigits: 0 })}%`;

export const PartyView = forwardRef<
  HTMLHeadingElement,
  {
    sessionId: string;
    party: NonNullable<Room["party"]>;
    meId: string;
    /** Room revision; the chat fetches new messages when it changes. */
    revision: number;
    busy: boolean;
    onAction: (action: PartyCommand) => void;
  }
>(function PartyView(
  { sessionId, party, meId, revision, busy, onAction },
  headingRef,
) {
  const plan = party.plan!;
  const [fareInput, setFareInput] = useState("");
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const leavePanel = useRef<HTMLDivElement>(null);
  const leaveButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  // Keep keyboard and screen-reader users oriented when the leave panel swaps in/out.
  useEffect(() => {
    if (confirmingLeave) leavePanel.current?.focus();
    else if (wasConfirming.current) leaveButton.current?.focus();
    wasConfirming.current = confirmingLeave;
  }, [confirmingLeave]);

  const selfies = new Map(
    party.members.map((member) => [member.participantId, member.selfieUrl]),
  );
  const mine = party.members.find((m) => m.participantId === meId);
  const me = plan.stops.find((s) => s.participantId === meId);
  const isDelegate = me?.role === "delegate";
  const confirmed = new Set(
    party.members
      .filter((m) => m.status === "confirmed")
      .map((m) => m.participantId),
  );
  const pending = party.members.length - confirmed.size;
  const others = party.members.length - 1;
  const fareMinor = parseFareMinor(fareInput);
  const fareInvalid = fareInput.trim() !== "" && fareMinor === null;
  const split =
    fareMinor === null
      ? null
      : apportionMinor(
          fareMinor,
          plan.stops.map((s) => s.fareShareBps),
        );
  const myIndex = plan.stops.findIndex((s) => s.participantId === meId);
  const live = party.status === "forming" || party.status === "confirmed";

  return (
    <section
      className="waiting-room party-room"
      aria-labelledby="matched-title"
    >
      <header className="room-heading">
        <span className="room-heading-icon">
          <CarFront size={24} aria-hidden="true" />
        </span>
        <div>
          <h2 id="matched-title" ref={headingRef} tabIndex={-1}>
            {TITLES[party.status]}
          </h2>
          <p>{HINTS[party.status]}</p>
        </div>
      </header>

      <div className="room-grid">
        <div className="room-main">
          {me && (
            <div className="my-share" aria-live="polite">
              <span>Tu parte</span>
              <strong>
                {split ? formatSoles(split[myIndex]) : percent(me.fareShareBps)}
              </strong>
              <small>
                {split
                  ? `${percent(me.fareShareBps)} del taxi`
                  : "del taxi. Escribe la tarifa para verla en soles."}
              </small>
            </div>
          )}

          <div className="fare-calculator">
            <label htmlFor="fare-input">
              Tarifa del taxi, si ya la conocen
            </label>
            <div className="fare-input-row">
              <span aria-hidden="true">S/</span>
              <input
                id="fare-input"
                inputMode="decimal"
                autoComplete="off"
                value={fareInput}
                aria-invalid={fareInvalid}
                aria-describedby={fareInvalid ? "fare-error" : undefined}
                onChange={(e) => setFareInput(e.target.value)}
                placeholder="45.00"
              />
            </div>
            {fareInvalid && (
              <p id="fare-error" role="alert" className="form-error">
                Escribe solo el monto en soles, por ejemplo 45 o 45.50.
              </p>
            )}
          </div>

          <h3>Ruta y reparto</h3>
          <ol className="roster">
            {plan.stops.map((stop, i) => (
              <li key={stop.participantId}>
                <span className="person-avatar" aria-hidden="true">
                  {selfies.get(stop.participantId) ? (
                    // Private, per-viewer photo; bypass the public image optimizer.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selfies.get(stop.participantId)!}
                      alt=""
                      className="member-selfie"
                    />
                  ) : (
                    stop.displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="person-name">
                  <strong>
                    {stop.displayName}
                    {stop.participantId === meId ? " (Tú)" : ""}
                    {confirmed.has(stop.participantId) && (
                      <Check
                        size={16}
                        aria-label="Confirmó"
                        className="inline-icon"
                      />
                    )}
                  </strong>
                  <span>
                    Parada {stop.dropOffOrder} · {stop.destinationLabel}
                  </span>
                  <span>
                    {stop.role === "delegate" ? "Reserva el taxi" : "Pasajero"}{" "}
                    · {Math.ceil(stop.arrivalSeconds / 60)} min desde el
                    encuentro
                    {stop.detourSeconds > 0 &&
                      ` · +${Math.ceil(stop.detourSeconds / 60)} min de desvío`}
                  </span>
                </div>
                <span className="person-share">
                  <strong>
                    {split ? formatSoles(split[i]) : percent(stop.fareShareBps)}
                  </strong>
                  {split && <small>{percent(stop.fareShareBps)}</small>}
                </span>
              </li>
            ))}
          </ol>

          {party.status === "forming" && mine?.status !== "confirmed" && (
            <button
              type="button"
              className="action action-primary"
              disabled={busy}
              onClick={() => onAction("confirm")}
            >
              Confirmar mi lugar y el reparto
            </button>
          )}
          {party.status === "forming" && mine?.status === "confirmed" && (
            <p role="status" className="wait-note">
              Esperando la confirmación de {pending}{" "}
              {pending === 1 ? "persona" : "personas"} más.
            </p>
          )}
          {isDelegate && party.status === "confirmed" && (
            <button
              type="button"
              className="action action-primary"
              disabled={busy}
              onClick={() => onAction("start")}
            >
              Iniciar viaje
            </button>
          )}
          {isDelegate && party.status === "in_progress" && (
            <button
              type="button"
              className="action action-primary"
              disabled={busy}
              onClick={() => onAction("complete")}
            >
              Finalizar viaje
            </button>
          )}
          {live &&
            (confirmingLeave ? (
              <div
                ref={leavePanel}
                tabIndex={-1}
                role="alertdialog"
                aria-labelledby="leave-title"
                aria-describedby="leave-body"
                className="leave-panel"
              >
                <strong id="leave-title">¿Salir del grupo de viaje?</strong>
                <p id="leave-body">
                  Esto afecta a {others} {others === 1 ? "persona" : "personas"}{" "}
                  más: el grupo se deshace y vuelven a la sala de espera para
                  recalcular la ruta y el reparto. Tú tendrás que unirte de
                  nuevo.
                </p>
                <div className="leave-actions">
                  <button
                    type="button"
                    className="action action-secondary"
                    onClick={() => setConfirmingLeave(false)}
                  >
                    Quedarme en el grupo
                  </button>
                  <button
                    type="button"
                    className="action action-danger"
                    disabled={busy}
                    onClick={() => onAction("leave")}
                  >
                    Sí, salir y deshacer el grupo
                  </button>
                </div>
              </div>
            ) : (
              <button
                ref={leaveButton}
                type="button"
                className="action action-secondary"
                onClick={() => setConfirmingLeave(true)}
              >
                Salir del grupo
              </button>
            ))}

          {party.status !== "cancelled" && (
            <PartyChat
              key={party.id}
              sessionId={sessionId}
              meId={meId}
              revision={revision}
            />
          )}

          <p className="fine">
            Jala no reserva ni cobra. El reparto se calcula por distancia, suma
            100% y solo tu grupo de viaje ve estas direcciones.
          </p>
        </div>
        <aside className="room-side">
          <RouteMap plan={plan} />

          <div className="own-destination">
            <MapPin size={23} aria-hidden="true" />
            <div>
              <span>Punto de encuentro</span>
              <strong>{plan.origin.label}</strong>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${plan.origin.latitude},${plan.origin.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir en Google Maps
                <ExternalLink size={15} aria-hidden="true" />
                <span className="sr-only"> (se abre en otra pestaña)</span>
              </a>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
});
