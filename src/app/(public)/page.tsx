import Link from "next/link";
import { Clock3, LocateFixed, Users } from "lucide-react";
import { DeparturePass } from "@/components/shared/departure-pass";

const steps = [
  {
    icon: LocateFixed,
    title: "Detectamos dónde estás",
    text: "Usamos tu ubicación como punto de salida. Si estás en un lugar frecuente, te llevamos a su punto de encuentro.",
  },
  {
    icon: Clock3,
    title: "Dinos a dónde y cuándo",
    text: "Elige tu destino exacto y si sales ahora o dentro de 15, 30 o 60 minutos.",
  },
  {
    icon: Users,
    title: "Únete o crea un grupo",
    text: "Te mostramos grupos cercanos que van hacia tu zona. Si no hay, creas uno y otros se suman. Todos confirman el reparto antes de salir.",
  },
];
export default function LandingPage() {
  return (
    <div>
      <section className="home-hero">
        <div className="hero-copy">
          <h1>
            Tu taxi,
            <br />
            con quienes
            <br />
            van hacia allá.
          </h1>
          <p>
            Dinos dónde estás y a dónde vas. Te juntamos con personas que salen
            cerca de ti hacia la misma zona para compartir un taxi.
          </p>
          <Link href="/ride" className="action action-primary">
            Pedir un grupo
          </Link>
          <Link href="/places" className="action action-secondary">
            Ver lugares frecuentes
          </Link>
          <p className="hero-footnote">
            Tú conservas tu destino. Quien reserva el taxi lo pide afuera.
          </p>
        </div>
        <DeparturePass />
      </section>
      <section className="how-section" aria-labelledby="como-funciona">
        <div className="section-intro">
          <h2 id="como-funciona">¿Cómo jalamos?</h2>
          <p>Tres pasos, sin salir de la web.</p>
        </div>
        <ol className="journey-steps">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <div className="step-symbol">
                <Icon size={25} strokeWidth={1.6} aria-hidden="true" />
                <span>{i + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>
      <aside className="fee-note">
        <span className="fee-note-mark" aria-hidden="true">
          S/
        </span>
        <div>
          <h2>El taxi se paga afuera, entre ustedes.</h2>
          <p>
            Jala no reserva ni cobra el taxi: quien reserva lo pide en otra app
            y cada persona paga su parte. Jala te muestra cuánto le toca a cada
            una según la distancia recorrida. Esta demo no realiza cobros.
          </p>
        </div>
      </aside>
    </div>
  );
}
