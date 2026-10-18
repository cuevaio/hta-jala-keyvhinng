import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function HeroRegistration() {
  return (
    <div className="hero-registration">
      <h2>Tu primer paso: crea tu cuenta</h2>
      <p>
        Regístrate para encontrar personas que van hacia tu zona y compartir un
        taxi.
      </p>
      <Link href="/sign-up?next=/ride" className="action action-primary">
        Registrarme
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
      <p className="hero-registration-signin">
        ¿Ya tienes cuenta? <Link href="/sign-in?next=/ride">Inicia sesión</Link>
      </p>
    </div>
  );
}
