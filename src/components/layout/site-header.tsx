import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="wordmark" aria-label="Jala, inicio">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <path
              d="M9 8v13a7 7 0 0 0 14 0V14"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="9" cy="7" r="4" fill="currentColor" />
            <circle cx="23" cy="10" r="4" fill="currentColor" />
          </svg>
          Jala
        </Link>
        <nav aria-label="Principal">
          <Link href="/events" className="nav-link">
            Eventos
          </Link>
          <Link href="/#como-funciona" className="nav-link nav-secondary">
            Cómo funciona
          </Link>
        </nav>
        <span className="location-tag">Hecho para salir juntos</span>
      </div>
    </header>
  );
}
