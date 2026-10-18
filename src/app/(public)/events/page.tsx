import type { Metadata } from "next";
import { connection } from "next/server";
import { CalendarDays } from "lucide-react";
import { EventCard } from "@/components/shared/event-card";
import { getServices } from "@/lib/services";
export const metadata: Metadata = { title: "Eventos" };
export default async function EventsPage() {
  await connection();
  const events = await getServices().events.list({ limit: 50 });
  return (
    <div className="events-page">
      <header className="page-heading">
        <h1>
          ¿De dónde
          <br />
          sales hoy?
        </h1>
        <p>
          Elige tu evento y entra a su sala de salida.
          <br className="desktop-break" /> El camino a casa empieza aquí.
        </p>
      </header>
      <div className="list-caption">
        <span>
          <CalendarDays size={18} aria-hidden="true" /> Eventos disponibles
        </span>
        <span>
          {events.length} {events.length === 1 ? "evento" : "eventos"}
        </span>
      </div>
      {events.length === 0 ? (
        <div className="empty-state">
          <CalendarDays size={32} aria-hidden="true" />
          <h2>Tu próxima salida está por llegar.</h2>
          <p>
            Aún no hay eventos publicados. Vuelve más tarde para encontrar una
            sala.
          </p>
        </div>
      ) : (
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      )}
      <p className="page-note">
        Estás explorando una demo. Los eventos publicados son ficticios.
      </p>
    </div>
  );
}
