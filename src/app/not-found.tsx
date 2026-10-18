import Link from "next/link";

export default function NotFound() {
  return (
    <div className="status-page session-closed" role="status">
      <h1>No encontramos esa página.</h1>
      <p>El enlace puede estar incompleto o la salida ya no existe.</p>
      <Link className="action action-primary" href="/places">
        Ver lugares
      </Link>
      <Link className="action action-secondary" href="/">
        Ir al inicio
      </Link>
    </div>
  );
}
