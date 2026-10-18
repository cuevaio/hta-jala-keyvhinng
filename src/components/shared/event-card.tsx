import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { EventStatusBadge } from "@/components/shared/event-status-badge";
import type { Event } from "@/modules/events/domain/event";

export function EventCard({ event }: { event: Event }) {
  const date = new Date(event.startsAt);
  const day = new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    timeZone: "America/Lima",
  }).format(date);
  const month = new Intl.DateTimeFormat("es-PE", {
    month: "short",
    timeZone: "America/Lima",
  })
    .format(date)
    .replace(".", "");
  const time = new Intl.DateTimeFormat("es-PE", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(date);
  return (
    <Link href={`/events/${event.id}`} className="event-ticket">
      <div className="ticket-date">
        <span>{day}</span>
        <span>{month}</span>
      </div>
      <div className="ticket-content">
        <div className="ticket-meta">
          <EventStatusBadge status={event.status} />
          {event.isFictional && (
            <span className="fiction-label">Evento ficticio</span>
          )}
        </div>
        <h2>{event.name.replace(/^\[DEMO\]\s*/, "")}</h2>
        <p>
          <MapPin size={16} aria-hidden="true" />
          {event.venueName}
        </p>
        <p className="ticket-time">
          {time} <span>Hora de Lima</span>
        </p>
      </div>
      <span className="ticket-open">
        <span>Ver salida</span>
        <ChevronRight size={22} aria-hidden="true" />
      </span>
    </Link>
  );
}
