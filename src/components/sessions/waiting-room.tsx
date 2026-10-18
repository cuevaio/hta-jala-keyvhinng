"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, MapPin, Users } from "lucide-react";
import type { GeoPoint } from "@/modules/places/domain/place";
import type { PartyCommand } from "@/modules/parties/domain/party-lifecycle";
import { roomDeadline } from "./room-clock";
import { useRoomClock } from "./use-room-clock";
import { PartyView } from "./party-view";
import { PoolView } from "./pool-view";
import { PushOptIn } from "./push-opt-in";
import { FULL_REFRESH_MS, nextPollDelay } from "./poll-delay";
import type { Room, RoomUnchanged } from "./room";
import { RideForm, type RideValues } from "./ride-form";
import { sessionApi, SessionRequestError } from "./session-api";

const limaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
  });

export interface GroupRoute {
  pickupLabel: string;
  pickup: GeoPoint;
  destinationLabel: string;
  destination: GeoPoint;
  departsAt: string;
}

export function WaitingRoom({
  sessionId,
  initialServerNow,
  group,
  closesAt,
  initiallyOpen,
  vehicleCapacity,
  initialRoom,
  initialSignedOut,
  accountName,
  pushPublicKey,
}: {
  sessionId: string;
  initialServerNow: string;
  group: GroupRoute;
  closesAt: string;
  initiallyOpen: boolean;
  vehicleCapacity: number;
  /** Loaded on the server so the first paint is the real state, not a spinner. */
  initialRoom: Room | null;
  initialSignedOut: boolean;
  accountName: string;
  /** VAPID public key; null when the server cannot send notifications. */
  pushPublicKey: string | null;
}) {
  const [room, setRoom] = useState<Room | null>(initialRoom);
  const [signedOut, setSignedOut] = useState(initialSignedOut);
  const [busy, setBusy] = useState(false);
  // Action errors stay until the next action; only a successful action clears them.
  const [actionError, setActionError] = useState("");
  const [pollError, setPollError] = useState("");
  const [notice, setNotice] = useState("");
  const [left, setLeft] = useState(false);
  const { now, synchronize } = useRoomClock(initialServerNow);
  const deadline = roomDeadline(closesAt, now);
  const hadParty = useRef(initialRoom?.party != null);
  const lastRoomSample = useRef(
    Date.parse(initialRoom?.serverNow ?? initialServerNow),
  );
  // Last revision applied, and when the last full room arrived (server render counts).
  const revision = useRef<number | null>(initialRoom?.revision ?? null);
  const lastFullAt = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const expired = deadline.phase === "closed";

  const apply = useCallback(
    (result: Room, roundTripMs = 0) => {
      const sampledAt = Date.parse(result.serverNow);
      if (sampledAt < lastRoomSample.current) return;
      lastRoomSample.current = sampledAt;
      if (hadParty.current && !result.party)
        setNotice(
          "Tu grupo de viaje se deshizo porque alguien salió. Sigues en la sala de espera y te buscamos un grupo nuevo automáticamente.",
        );
      hadParty.current = result.party !== null;
      revision.current = result.revision;
      lastFullAt.current = performance.now();
      synchronize(result.serverNow, roundTripMs);
      setRoom(result);
      setSignedOut(false);
    },
    [synchronize],
  );

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let active: AbortController | null = null;
    let failures = 0;
    if (revision.current !== null) lastFullAt.current = performance.now();
    async function poll() {
      clearTimeout(timer);
      active?.abort();
      const controller = new AbortController();
      active = controller;
      const startedAt = performance.now();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const failed = () => {
        failures += 1;
        setPollError(
          "No pudimos actualizar la sala. Reintentaremos automáticamente.",
        );
      };
      try {
        if (document.visibilityState !== "visible") return;
        // Ask only "anything new?" unless a periodic full refresh is due.
        const known = revision.current;
        const full =
          known === null || startedAt - lastFullAt.current >= FULL_REFRESH_MS;
        const result = await sessionApi<Room | RoomUnchanged>(
          `/api/sessions/${sessionId}/waiting-room${full ? "" : `?rev=${known}`}`,
          undefined,
          controller.signal,
        );
        if (!stopped && active === controller && !controller.signal.aborted) {
          const roundTripMs = performance.now() - startedAt;
          if ("unchanged" in result) synchronize(result.serverNow, roundTripMs);
          else apply(result, roundTripMs);
          failures = 0;
          setPollError("");
        }
      } catch (error) {
        if (
          !stopped &&
          active === controller &&
          document.visibilityState === "visible" &&
          error instanceof SessionRequestError
        ) {
          if (error.status === 401) {
            setSignedOut(true);
            setRoom(null);
            revision.current = null;
          }
          if (error.status === 401 || error.status === 403) {
            // Visitors and people who have not joined still get fresh server time.
            try {
              const timing = await sessionApi<{ serverNow: string }>(
                `/api/sessions/${sessionId}`,
                undefined,
                controller.signal,
              );
              if (
                !stopped &&
                active === controller &&
                !controller.signal.aborted
              ) {
                synchronize(timing.serverNow, performance.now() - startedAt);
                failures = 0;
                setPollError("");
              }
            } catch {
              if (
                !stopped &&
                active === controller &&
                document.visibilityState === "visible"
              )
                failed();
            }
          } else {
            failed();
          }
        }
      } finally {
        clearTimeout(timeout);
        if (
          !stopped &&
          active === controller &&
          document.visibilityState === "visible"
        )
          timer = setTimeout(poll, nextPollDelay(failures));
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
      else {
        clearTimeout(timer);
        active?.abort();
      }
    };
    // A push for this room means it changed: check now rather than at the next tick.
    const onPush = (event: MessageEvent) => {
      if (
        event.data?.type === "room-changed" &&
        event.data.url === `/sessions/${sessionId}` &&
        document.visibilityState === "visible"
      )
        void poll();
    };
    timer = setTimeout(poll, 0);
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onPush);
    return () => {
      stopped = true;
      clearTimeout(timer);
      active?.abort();
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onPush);
    };
  }, [sessionId, apply, synchronize]);

  const closed =
    expired || !initiallyOpen || (room !== null && !room.acceptingJoins);

  // Move focus to the new heading whenever the screen changes, never on first paint.
  const stage = left
    ? "left"
    : closed && !room?.party
      ? "closed"
      : signedOut && !room
        ? "signed-out"
        : !room
          ? "join"
          : room.party?.plan
            ? `party:${room.party.status}`
            : "pool";
  const previousStage = useRef(stage);
  useEffect(() => {
    if (previousStage.current !== stage) heading.current?.focus();
    previousStage.current = stage;
  }, [stage]);

  async function run(task: () => Promise<void>, fallback: string) {
    setBusy(true);
    setActionError("");
    try {
      await task();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  const fetchRoom = () =>
    sessionApi<Room>(`/api/sessions/${sessionId}/waiting-room`);

  function join(values: RideValues) {
    return run(async () => {
      await sessionApi(`/api/sessions/${sessionId}/join`, {
        displayName: values.displayName,
        selfieDataUrl: values.selfieDataUrl,
        originLabel: values.origin.label,
        originLatitude: values.origin.point.latitude,
        originLongitude: values.origin.point.longitude,
        destinationLabel: values.destination.label,
        latitude: values.destination.point.latitude,
        longitude: values.destination.point.longitude,
        delegatePreference: values.delegatePreference,
      });
      apply(await fetchRoom());
    }, "No se pudo guardar tu ruta.");
  }

  function match() {
    setNotice("");
    return run(async () => {
      await sessionApi(`/api/sessions/${sessionId}/match`, {});
      const result = await fetchRoom();
      apply(result);
      if (!result.party)
        setNotice(
          "Aún no encontramos compañeros de viaje compatibles. Sigues en la sala de espera; te agrupamos automáticamente cuando lleguen más personas.",
        );
    }, "No pudimos buscar compañeros de viaje.");
  }

  function partyAction(action: PartyCommand) {
    return run(async () => {
      await sessionApi(`/api/sessions/${sessionId}/party`, { action });
      if (action === "leave") {
        hadParty.current = false;
        setLeft(true);
        setRoom(null);
        return;
      }
      apply(await fetchRoom());
    }, "No pudimos completar la acción.");
  }

  // Matching forms parties of two or three, whatever the vehicle holds.
  const taxiSize = vehicleCapacity > 2 ? "2 o 3" : "2";
  const placeLink = (
    <Link className="action action-secondary" href="/ride">
      Buscar otra sala
    </Link>
  );

  if (left)
    return (
      <div className="session-closed" role="status">
        <h2 ref={heading} tabIndex={-1}>
          Saliste del grupo de viaje.
        </h2>
        <p>
          El grupo se deshizo para recalcular rutas y reparto con quienes
          quedan. Puedes buscar otra sala o crear una.
        </p>
        {placeLink}
      </div>
    );

  return (
    <div className="session-content">
      <div className="session-meta">
        <p className="ride-route-summary">
          <MapPin size={17} aria-hidden="true" />
          {group.pickupLabel.split(",")[0]}
          <ArrowRight size={15} aria-hidden="true" />
          {group.destinationLabel.split(",")[0]}
        </p>
        <div className="session-tags">
          <span className="tag">
            <Clock3 size={14} aria-hidden="true" />
            Sale {limaTime(group.departsAt)}
          </span>
          <span className="tag">
            <Users size={14} aria-hidden="true" />
            {taxiSize} personas por taxi
          </span>
          <span className="tag">
            {closed
              ? "Sala cerrada"
              : `Cierra a las ${limaTime(closesAt)} (Lima)`}
          </span>
          {!closed && (
            <span
              className="tag room-countdown"
              role="timer"
              aria-live="off"
              aria-label="Tiempo restante para unirse y formar un grupo"
            >
              Cierra en {deadline.label}
            </span>
          )}
        </div>
      </div>
      <p
        role="status"
        className={`room-deadline ${!closed && deadline.phase === "closing" ? "room-deadline-warning" : ""}`}
      >
        {closed
          ? room?.party
            ? "La sala está cerrada para nuevas personas. Tu grupo ya está formado y sigue disponible."
            : "La sala cerró. Ya no puedes unirte ni formar un grupo de viaje."
          : deadline.phase === "closing"
            ? "La sala cierra en 5 minutos o menos. Únete o busca compañeros antes de que termine la espera."
            : "La sala cierra 30 minutos después de la hora de salida. Después no podrás unirte ni formar un grupo. Los grupos ya formados pueden continuar su viaje."}
      </p>
      {actionError && (
        <p role="alert" className="form-error">
          {actionError}
        </p>
      )}
      {pollError && (
        <p role="status" className="form-error">
          {pollError}
        </p>
      )}
      {room &&
        !left &&
        (room.party
          ? room.party.status === "forming" || room.party.status === "confirmed"
          : !closed) && <PushOptIn publicKey={pushPublicKey} />}
      {closed && !room?.party && (
        <div role="status" className="session-closed">
          <h2 ref={!room ? heading : undefined} tabIndex={-1}>
            Sala cerrada
          </h2>
          <p>Puedes buscar otra sala o crear una.</p>
          {placeLink}
        </div>
      )}
      {signedOut && !room && !closed ? (
        <div className="session-closed">
          <h2 ref={heading} tabIndex={-1}>
            Inicia sesión para unirte.
          </h2>
          <p>Necesitas una cuenta para guardar tu ruta en la sala.</p>
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
      ) : room?.party?.plan ? (
        <PartyView
          ref={heading}
          sessionId={sessionId}
          party={room.party}
          meId={room.me.id}
          revision={room.revision}
          busy={busy}
          onAction={partyAction}
        />
      ) : room ? (
        <PoolView
          ref={heading}
          room={room}
          closed={closed}
          busy={busy}
          signedOut={signedOut}
          notice={notice}
          onMatch={match}
          onCopyFailed={() =>
            setActionError(
              "Copia la dirección de esta página desde tu navegador para compartirla.",
            )
          }
        />
      ) : (
        !closed && (
          <RideForm
            initial={{ origin: null, destination: null, departInMinutes: 0 }}
            defaultName={accountName}
            showTime={false}
            submitLabel="Entrar a la sala"
            busyLabel="Guardando tu ruta…"
            busy={busy}
            mapCenter={group.pickup}
            onSubmit={join}
          />
        )
      )}
    </div>
  );
}
