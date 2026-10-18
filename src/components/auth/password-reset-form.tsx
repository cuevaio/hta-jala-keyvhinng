"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";
import { sessionApi } from "@/components/sessions/session-api";

export function PasswordResetForm({
  mode,
  token = "",
  accountEmail = null,
}: {
  mode: "request" | "confirm";
  token?: string;
  /** The account behind the reset link, so password managers update that login. */
  accountEmail?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await sessionApi(
        mode === "request"
          ? "/api/auth/password-reset/request"
          : "/api/auth/password-reset/confirm",
        mode === "request"
          ? { email: data.get("email") }
          : { token, password: data.get("password") },
      );
      setDone(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "No se pudo continuar.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="session-closed" role="status">
        <h1>
          {mode === "request" ? "Revisa tu correo." : "Contraseña lista."}
        </h1>
        <p>
          {mode === "request"
            ? "Si existe una cuenta con ese correo, enviamos un enlace válido por 30 minutos."
            : "Ya puedes iniciar sesión con tu nueva contraseña. Cerramos tus otras sesiones."}
        </p>
        <Link className="action action-primary" href="/sign-in">
          Iniciar sesión
        </Link>
      </div>
    );

  return (
    <form
      id={`password-reset-${mode}-form`}
      method="post"
      onSubmit={submit}
      className="join-form auth-form"
    >
      <header className="form-heading">
        <h1>
          {mode === "request"
            ? "Recupera tu contraseña"
            : "Elige una contraseña nueva"}
        </h1>
        <p>
          {mode === "request"
            ? "Te enviaremos un enlace para crear una nueva."
            : "Usa al menos 8 caracteres."}
        </p>
      </header>
      <div className="form-section">
        {mode === "request" ? (
          <>
            <label htmlFor="reset-email">Correo</label>
            <div className="input-with-icon">
              <Mail size={19} aria-hidden="true" />
              <input
                id="reset-email"
                className="form-input"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
              />
            </div>
          </>
        ) : (
          <>
            {accountEmail && (
              <>
                <p className="fine reset-account">Cuenta: {accountEmail}</p>
                <input
                  type="email"
                  name="username"
                  autoComplete="username"
                  value={accountEmail}
                  readOnly
                  hidden
                />
              </>
            )}
            <label htmlFor="reset-password">Contraseña nueva</label>
            <div className="input-with-icon">
              <KeyRound size={19} aria-hidden="true" />
              <input
                id="reset-password"
                className="form-input"
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
            </div>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button disabled={busy} className="action action-primary form-submit">
        {busy
          ? "Enviando…"
          : mode === "request"
            ? "Enviar enlace"
            : "Guardar contraseña"}
      </button>
    </form>
  );
}
