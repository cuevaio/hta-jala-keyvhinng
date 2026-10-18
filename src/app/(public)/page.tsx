import Link from "next/link";
import { MapPin, Route, Users } from "lucide-react";
import { DeparturePass } from "@/components/shared/departure-pass";

const steps = [
  {
    icon: MapPin,
    title: "Elige dónde estás",
    text: "Universidad, centro comercial, concierto o estación. Abre la sala de salida y comparte el enlace con quienes también se van.",
  },
  {
    icon: Route,
    title: "Dinos a dónde vas",
    text: "Guarda tu destino exacto e indica si puedes reservar el taxi para el grupo.",
  },
  {
    icon: Users,
    title: "Comparte la sala",
    text: "Te juntamos con 1 o 2 personas que van por tu ruta. Todas confirman el reparto antes de salir.",
  },
];
export default function LandingPage() {
  return (
    <div>
      <section className="home-hero">
        <div className="hero-copy">
          <h1>
            De la salida
            <br />
            a tu
            <br />
            puerta.
          </h1>
          <p>
            La salida también es parte del plan. Reúnete con personas que salen
            del mismo lugar para organizar un taxi compartido.
          </p>
          <Link href="/places" className="action action-primary">
            Elegir mi lugar
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
          <p>Empieza por encontrar tu sala.</p>
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
