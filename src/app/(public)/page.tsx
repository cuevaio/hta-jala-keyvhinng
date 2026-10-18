import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  ArrowUpRight,
  CarFront,
  Clock3,
  LocateFixed,
  Route,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { HeroSearch } from "@/components/home/hero-search";
import { RouteVisual } from "@/components/home/route-visual";
import { PlaceCard } from "@/components/shared/place-card";
import { logger } from "@/lib/logger";
import { getServices } from "@/lib/services";
import type { Place } from "@/modules/places/domain/place";

const steps = [
  {
    icon: LocateFixed,
    title: "Dinos dónde estás",
    text: "Usamos tu ubicación como punto de salida, o eliges uno de los lugares frecuentes.",
  },
  {
    icon: Clock3,
    title: "A dónde y cuándo",
    text: "Marca tu destino exacto y si sales ahora o dentro de 15, 30 o 60 minutos.",
  },
  {
    icon: Users,
    title: "Únete o crea un grupo",
    text: "Te mostramos grupos cercanos hacia tu zona. Si no hay, creas uno y otros se suman.",
  },
];

const benefits = [
  {
    icon: Wallet,
    title: "Pagas tu tramo, no el taxi entero",
    text: "El reparto se calcula por la distancia que recorre cada persona y siempre suma 100%.",
  },
  {
    icon: Route,
    title: "Desvío máximo de cinco minutos",
    text: "Solo agrupamos destinos compatibles por tiempo real de manejo, no por línea recta.",
  },
  {
    icon: ShieldCheck,
    title: "Tu dirección exacta es privada",
    text: "Solo la ven las personas de tu grupo, y solo cuando el grupo se forma.",
  },
  {
    icon: CarFront,
    title: "Ustedes reservan el taxi",
    text: "Una persona del grupo lo reserva en su app de siempre. Jala no reserva ni cobra.",
  },
];

/** The landing still renders when the database is unreachable; it just lists no places. */
async function featuredPlaces(): Promise<Place[]> {
  try {
    return await getServices().places.list({ status: "active", limit: 4 });
  } catch (error) {
    logger.error("landing.places_failed", { error: String(error) });
    return [];
  }
}

export default async function LandingPage() {
  await connection();
  const places = await featuredPlaces();
  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" aria-hidden="true" /> Lima se mueve mejor
            en grupo
          </p>
          <h1>
            No vuelvas solo.
            <br />
            <span>Jala contigo.</span>
          </h1>
          <p className="intro">
            Comparte un taxi con personas que salen cerca de ti y van hacia tu
            misma zona. Cada quien llega a su puerta y paga su parte.
          </p>
          <HeroSearch
            origins={places.map(({ id, name, location }) => ({
              id,
              name,
              location,
            }))}
          />
          <p className="hero-note">
            <ShieldCheck size={17} aria-hidden="true" /> Tu destino exacto solo
            lo ve tu grupo.
          </p>
        </div>
        <RouteVisual />
      </section>

      <section className="section wrap" id="como-funciona">
        <div className="section-head">
          <div>
            <p className="eyebrow">Así de simple</p>
            <h2>Volver a casa, en tres pasos.</h2>
          </div>
          <p>Todo desde la web, sin instalar nada.</p>
        </div>
        <ol className="steps">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <div className="step-top">
                <span className="step-icon">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <span className="step-number">{i + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="benefit-section" id="por-que">
        <div className="wrap benefit-grid">
          <div>
            <p className="eyebrow">Misma ruta. Mejor viaje.</p>
            <h2>Lo bueno de compartir empieza en el camino.</h2>
            <p>
              Ese asiento vacío puede ser tu próximo ahorro. Jala arma el grupo
              y calcula el reparto; el viaje lo hacen ustedes.
            </p>
            <Link className="text-link" href="/ride">
              Encuentra tu próximo viaje
              <ArrowUpRight size={19} aria-hidden="true" />
            </Link>
          </div>
          <ul className="benefit-list">
            {benefits.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon size={20} aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {places.length > 0 && (
        <section className="section wrap" id="lugares">
          <div className="section-head">
            <div>
              <p className="eyebrow">Del plan a casa</p>
              <h2>¿De dónde salimos hoy?</h2>
            </div>
            <Link className="text-link" href="/places">
              Ver todos los lugares
              <ArrowUpRight size={19} aria-hidden="true" />
            </Link>
          </div>
          <ul className="place-grid">
            {places.map((place) => (
              <li key={place.id}>
                <PlaceCard place={place} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="cta wrap-inset">
        <div>
          <p>Tu ruta, nuestro viaje.</p>
          <h2>El próximo regreso, hagámoslo juntos.</h2>
        </div>
        <Link href="/ride" className="action action-primary">
          Pedir un grupo
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
