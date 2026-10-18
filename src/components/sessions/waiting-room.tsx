"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock3, Users } from "lucide-react";
import type { GeoPoint } from "@/modules/places/domain/place";
import type { PartyCommand } from "@/modules/parties/domain/party-lifecycle";
import { PartyView } from "./party-view";
import { PoolView } from "./pool-view";
import type { Room } from "./room";
import { SessionJoinForm } from "./session-join-form";
import { sessionApi, SessionRequestError } from "./session-api";

const POLL_MS = 4000;

export function WaitingRoom({
  sessionId,
  placeId,
  closesAt,
  initiallyOpen,
  vehicleCapacity,
  mapCenter,
  initialRoom,
  initialSignedOut,
  accountName,
}: {
  sessionId: string;
  placeId: string;
  closesAt: string;
  initiallyOpen: boolean;
  vehicleCapacity: number;
  mapCenter: GeoPoint;
  /** Loaded on the server so the first paint is the real state, not a spinner. */
  initialRoom: Room | null;
  initialSignedOut: boolean;
  accountName: string;
}) {
  const [room, setRoom] = useState<Room | null>(initialRoom);
  const [signedOut, setSignedOut] = useState(initialSignedOut);
  const [busy, setBusy] = useState(false);
  // Action errors stay until the next action; only a successful action clears them.
  const [actionError, setActionError] = useState("");
  const [pollError, setPollError] = useState("");
  const [notice, setNotice] = useState("");
  const [left, setLeft] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const hadParty = useRef(initialRoom?.party != null);
  const heading = useRef<HTMLHeadingElement>(null);
  const expired = now >= Date.parse(closesAt);

  const apply = useCallback((result: Room) => {
    if (hadParty.current && !result.party)
      setNotice(
        "Tu grupo se deshizo porque alguien salió. Busca otro grupo cuando quieras.",
      );
    hadParty.current = result.party !== null;
    setRoom(result);
    setSignedOut(false);
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      // Hidden tabs skip the request; becoming visible again polls immediately.
      if (document.visibilityState === "visible") {
        try {
          const result = await sessionApi<Room>(
            `/api/sessions/${sessionId}/waiting-room`,
          );
          if (!stopped) {
            apply(result);
            setPollError("");
          }
        } catch (error) {
          if (!stopped && error instanceof SessionRequestError) {
            if (error.status === 401) {
              setSignedOut(true);
              setRoom(null);
            } else if (error.status !== 403) {
              setPollError(
                "No pudimos actualizar la sala. Reintentaremos automáticamente.",
              );
            }
          }
        }
        if (!stopped) setNow(Date.now());
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    }
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void poll();
    };
    timer = setTimeout(poll, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionId, apply]);

  // Move focus to the new heading whenever the screen changes, never on first paint.
  const stage = left
    ? "left"
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

  function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    return run(async () => {
      await sessionApi(`/api/sessions/${sessionId}/join`, {
        displayName: data.get("displayName"),
        destinationLabel: data.get("destinationLabel"),
        latitude: Number(data.get("latitude")),
        longitude: Number(data.get("longitude")),
        delegatePreference: data.get("delegatePreference"),
      });
      apply(await fetchRoom());
    }, "No se pudo guardar tu destino.");
  }

  function match() {
    setNotice("");
    return run(async () => {
      await sessionApi(`/api/sessions/${sessionId}/match`, {});
      const result = await fetchRoom();
      apply(result);
      if (!result.party)
        setNotice(
          "Aún no encontramos un grupo compatible para ti. Sigues en la sala; puedes intentar cuando lleguen más personas.",
        );
    }, "No pudimos buscar tu grupo.");
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

  const closed =
    expired || !initiallyOpen || (room !== null && !room.acceptingJoins);
  const placeLink = (
    <Link className="action action-secondary" href={`/places/${placeId}`}>
      Volver al lugar
    </Link>
  );

  if (left)
    return (
      <div className="session-closed" role="status">
        <h2 ref={heading} tabIndex={-1}>
          Saliste del grupo.
        </h2>
        <p>
          El grupo se deshizo para recalcular rutas y reparto con quienes
          quedan. Puedes volver al lugar y elegir otra salida.
        </p>
        {placeLink}
      </div>
    );
  if (signedOut && !room)
    return (
      <div className="session-closed">
        <h2 ref={heading} tabIndex={-1}>
          Inicia sesión para unirte.
        </h2>
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
      {closed && !room?.party && (
        <div role="status" className="session-closed">
          <h2>Esta sala ya no admite pasajeros.</h2>
          <p>Puedes volver al lugar y elegir otra salida.</p>
          {placeLink}
        </div>
      )}
      {room?.party?.plan ? (
        <PartyView
          ref={heading}
          party={room.party}
          meId={room.me.id}
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
