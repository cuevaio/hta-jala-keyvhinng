import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { DeparturePass } from "@/components/shared/departure-pass";

const steps = [
  {
    icon: CalendarDays,
    title: "Elige tu evento",
    text: "Abre una sala de salida y comparte el enlace con otras personas del evento.",
  },
  {
    icon: MapPin,
    title: "Dinos a dónde vas",
    text: "Guarda tu destino exacto e indica si puedes reservar el taxi para el grupo.",
  },
  {
    icon: Users,
    title: "Comparte la sala",
    text: "Ve quién está esperando. El emparejamiento automático llegará en la siguiente etapa.",
  },
];
export default function LandingPage() {
  return (
    <div>
      <section className="home-hero">
        <div className="hero-copy">
          <h1>
            Del último
            <br />
            aplauso
            <br />a tu puerta.
          </h1>
          <p>
            La salida también es parte del plan. Reúnete con personas de tu
            evento para organizar un taxi compartido.
          </p>
          <Link href="/events" className="action action-primary">
            Elegir mi evento
          </Link>
          <p className="hero-footnote">
            Tú conservas tu destino. El delegado reserva afuera.
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
          <h2>El taxi y la comisión son cosas distintas.</h2>
          <p>
            La propuesta de Jala exonera la comisión de tus primeros cinco
            viajes y la de quien reserva. Cada persona paga su parte del taxi.
            Esta demo no realiza cobros.
          </p>
        </div>
      </aside>
    </div>
  );
}
