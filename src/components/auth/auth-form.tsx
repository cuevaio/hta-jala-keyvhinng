"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, UserRound } from "lucide-react";
import { sessionApi } from "@/components/sessions/session-api";

const COPY = {
  "sign-in": {
    title: "Inicia sesión",
    intro: "Entra para unirte a una salida compartida.",
    submit: "Iniciar sesión",
    busy: "Entrando…",
    switchText: "¿No tienes cuenta?",
    switchLink: "Crear cuenta",
    switchHref: "/sign-up",
  },
  "sign-up": {
    title: "Crea tu cuenta",
    intro: "Con tu cuenta Jala recuerda tus salidas y tus viajes gratis.",
    submit: "Crear cuenta",
    busy: "Creando cuenta…",
    switchText: "¿Ya tienes cuenta?",
    switchLink: "Iniciar sesión",
    switchHref: "/sign-in",
  },
} as const;

export function AuthForm({
  mode,
  next,
}: {
  mode: keyof typeof COPY;
  /** Already sanitized by the server page with safeNextPath. */
  next: string;
}) {
  const copy = COPY[mode];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await sessionApi(`/api/auth/${mode}`, {
        displayName: data.get("displayName") ?? undefined,
        email: data.get("email"),
        password: data.get("password"),
      });
      router.replace(next);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "No se pudo continuar.",
      );
      setBusy(false);
    }
  }

  const switchHref =
    next === "/"
      ? copy.switchHref
      : `${copy.switchHref}?next=${encodeURIComponent(next)}`;

  return (
    <form onSubmit={submit} className="join-form auth-form">
      <header className="form-heading">
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>
      {mode === "sign-up" && (
        <div className="form-section">
          <label htmlFor="auth-name">¿Cómo te llamas?</label>
          <div className="input-with-icon">
            <UserRound size={19} aria-hidden="true" />
            <input
              id="auth-name"
              className="form-input"
              name="displayName"
              required
              maxLength={60}
              autoComplete="name"
              placeholder="Tu nombre"
            />
          </div>
        </div>
      )}
      <div className="form-section">
        <label htmlFor="auth-email">Correo</label>
        <div className="input-with-icon">
          <Mail size={19} aria-hidden="true" />
          <input
            id="auth-email"
            className="form-input"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="tu@correo.com"
          />
        </div>
      </div>
      <div className="form-section">
        <label htmlFor="auth-password">Contraseña</label>
        <div className="input-with-icon">
          <KeyRound size={19} aria-hidden="true" />
          <input
            id="auth-password"
            className="form-input"
            name="password"
            type="password"
            required
            minLength={mode === "sign-up" ? 8 : undefined}
            maxLength={128}
            autoComplete={
              mode === "sign-up" ? "new-password" : "current-password"
            }
          />
        </div>
        {mode === "sign-up" && (
          <p className="input-help">Usa al menos 8 caracteres.</p>
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button disabled={busy} className="action action-primary form-submit">
        {busy ? copy.busy : copy.submit}
      </button>
      <p className="auth-switch">
        {copy.switchText} <Link href={switchHref}>{copy.switchLink}</Link>
      </p>
    </form>
  );
}
