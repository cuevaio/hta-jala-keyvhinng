import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

// Unmatched URLs render outside every route group, so this brings its own chrome.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="contenido" className="site-main">
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
      </main>
      <SiteFooter />
    </>
  );
}
