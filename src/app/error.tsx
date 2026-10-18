"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="session-closed" role="alert">
      <h1>Algo salió mal.</h1>
      <p>
        No pudimos cargar esta página. Tu salida no se perdió; intenta de nuevo.
      </p>
      <button type="button" className="action action-primary" onClick={reset}>
        Reintentar
      </button>
      <Link className="action action-secondary" href="/">
        Ir al inicio
      </Link>
    </div>
  );
}
