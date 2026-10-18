"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell } from "lucide-react";
import { enablePush, pushSupport } from "./push-client";

type State = "hidden" | "install" | "ask" | "busy" | "on" | "blocked" | "error";

/**
 * Offers room notifications once someone is in a room, never on page load: a refused
 * browser prompt is close to permanent. The room keeps working without them.
 */
function detect(publicKey: string | null): State {
  if (!publicKey) return "hidden";
  const support = pushSupport();
  if (support === "needs-install") return "install";
  if (support === "unsupported") return "hidden";
  return Notification.permission === "granted"
    ? "on"
    : Notification.permission === "denied"
      ? "blocked"
      : "ask";
}
const noSubscription = () => () => {};

export function PushOptIn({ publicKey }: { publicKey: string | null }) {
  // Browser capabilities are only known after hydration; the server renders nothing.
  const detected = useSyncExternalStore(
    noSubscription,
    () => detect(publicKey),
    () => "hidden" as const,
  );
  const [chosen, setState] = useState<State | null>(null);
  const state = chosen ?? detected;

  useEffect(() => {
    // Already allowed: re-link this browser in case the account or key changed.
    if (detected === "on" && publicKey)
      enablePush(publicKey).catch(() => setState("ask"));
  }, [detected, publicKey]);

  async function enable() {
    if (!publicKey) return;
    setState("busy");
    try {
      await enablePush(publicKey);
      setState("on");
    } catch {
      setState(Notification.permission === "denied" ? "blocked" : "error");
    }
  }

  if (state === "hidden") return null;
  if (state === "on")
    return (
      <p className="fine push-status">
        <Bell size={15} aria-hidden="true" />
        Avisos activados en este dispositivo.
      </p>
    );
  if (state === "blocked")
    return (
      <p className="fine push-status">
        <Bell size={15} aria-hidden="true" />
        Los avisos están bloqueados en tu navegador. Mantén esta página abierta
        para ver los cambios.
      </p>
    );
  if (state === "install")
    return (
      <p className="fine push-status">
        <Bell size={15} aria-hidden="true" />
        Para recibir avisos en iPhone, añade Jala a tu pantalla de inicio
        (Compartir → Añadir a inicio) y ábrela desde ahí.
      </p>
    );
  return (
    <div className="notice push-opt-in">
      <Bell size={20} aria-hidden="true" />
      <p>
        {state === "error"
          ? "No pudimos activar los avisos. Intenta de nuevo."
          : "Te avisamos cuando se forme tu grupo y cuando todos confirmen, aunque cierres esta página."}
      </p>
      <button
        type="button"
        className="action action-secondary action-small"
        disabled={state === "busy"}
        onClick={enable}
      >
        {state === "busy" ? "Activando…" : "Activar avisos"}
      </button>
    </div>
  );
}
