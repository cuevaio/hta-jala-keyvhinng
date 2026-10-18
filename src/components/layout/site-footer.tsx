import Link from "next/link";
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <Link href="/" className="footer-brand">
            Jala
          </Link>
          <p>La salida también se comparte.</p>
        </div>
        <div className="footer-note">
          <p>Hecho en Lima para Hack The Andes 2026.</p>
          <p>
            Demo con lugares ficticios. Jala no opera taxis ni procesa pagos.
          </p>
        </div>
      </div>
    </footer>
  );
}
