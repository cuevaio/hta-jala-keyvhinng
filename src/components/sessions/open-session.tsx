"use client";

import { Users, Clock3 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sessionApi } from "./session-api";

export function OpenSession({
  eventId,
  disabled,
}: {
  eventId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function open() {
    setBusy(true);
    setError("");
    try {
      await sessionApi("/api/participant", {});
      const session = await sessionApi<{ id: string }>("/api/sessions", {
        eventId,
      });
      router.push(`/sessions/${session.id}`);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "No se pudo abrir la sesión.",
      );
      setBusy(false);
    }
  }
  return (
    <aside className="join-pass">
      <div className="join-pass-content">
        <span className="join-pass-icon">
          <Users size={27} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h2>
          Tu salida
          <br />
          empieza aquí.
        </h2>
        <p>
          Entra a la sala del evento, guarda tu destino y conoce a quienes
          también están por salir.
        </p>
        <button
          className="action action-primary"
          disabled={disabled || busy}
          onClick={open}
        >
          {busy
            ? "Abriendo sala…"
            : disabled
              ? "Evento cerrado"
              : "Entrar a la sala"}
        </button>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
      <div className="join-pass-footer">
        <Clock3 size={17} aria-hidden="true" />
        <span>Si no hay una sala abierta, creamos una de 2 horas.</span>
      </div>
    </aside>
  );
}
