import Link from "next/link";

export function NotFoundMessage() {
  return (
    <div className="status-page session-closed" role="status">
      <h1>No encontramos esa página.</h1>
      <p>El enlace puede estar incompleto o la salida ya no existe.</p>
      <Link className="action action-primary" href="/">
        Ir al inicio
      </Link>
    </div>
  );
}
