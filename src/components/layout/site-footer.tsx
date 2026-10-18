import Link from "next/link";
import { Wordmark } from "./wordmark";

export function SiteFooter() {
  return (
    <footer className="site-footer wrap">
      <div className="footer-top">
        <div>
          <Wordmark className="wordmark-small" />
          <p>Tu ruta, nuestro viaje.</p>
        </div>
        <nav aria-label="Pie de página">
          <Link href="/ride">Compartir un taxi</Link>
          <Link href="/places">Lugares</Link>
          <Link href="/#como-funciona">Cómo funciona</Link>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>Hecho en Lima para Hack The Andes 2026.</span>
        <span>Demo con lugares ficticios. Jala no opera taxis ni cobra.</span>
      </div>
    </footer>
  );
}
