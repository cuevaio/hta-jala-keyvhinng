import { OpenSession } from "@/components/sessions/open-session";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CalendarDays, MapPin } from "lucide-react";
import { EventStatusBadge } from "@/components/shared/event-status-badge";
import { NotFoundError } from "@/lib/errors";
import { getServices } from "@/lib/services";
import { formatEventDate } from "@/lib/utils";
import { eventIdParams } from "@/modules/events/schemas/event.schema";

async function loadEvent(params: Promise<{ id: string }>) {
  const parsed = eventIdParams.safeParse(await params);
  if (!parsed.success) notFound();
  try {
    return await getServices().events.getById(parsed.data.id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/events/[id]">): Promise<Metadata> {
  await connection();
  const event = await loadEvent(params);
  return { title: event.name };
}

export default async function EventDetailPage({
  params,
}: PageProps<"/events/[id]">) {
  await connection();
  const event = await loadEvent(params);

  return (
    <article className="event-detail">
      <Link href="/events" className="back-link">
        <ChevronLeft size={17} aria-hidden="true" />
        Todos los eventos
      </Link>
      <div className="event-detail-grid">
        <div>
          <header className="event-heading">
            <div className="ticket-meta">
              <EventStatusBadge status={event.status} />
              {event.isFictional && (
                <span className="fiction-label">
                  Evento ficticio de demostración
                </span>
              )}
            </div>
            <h1>{event.name.replace(/^\[DEMO\]\s*/, "")}</h1>
            <p className="event-fact">
              <CalendarDays size={19} aria-hidden="true" />
              {formatEventDate(event.startsAt)}
            </p>
            <p className="event-fact">
              <MapPin size={19} aria-hidden="true" />
              {event.venueName}
            </p>
            <p className="event-description">{event.description}</p>
          </header>
          <section className="meeting-section" aria-labelledby="puntos">
            <h2 id="puntos">Puntos para encontrarse</h2>
            <p className="section-help">
              Referencias cerca del evento. Todavía no tienes un punto asignado.
            </p>
            {event.meetingPoints.length === 0 ? (
              <p className="empty-state">
                Aún no hay puntos definidos para este evento.
              </p>
            ) : (
              <ul className="meeting-list">
                {event.meetingPoints.map((point) => (
                  <li key={point.id}>
                    <span className="meeting-pin">
                      <MapPin size={19} aria-hidden="true" />
                    </span>
                    <div>
                      <h3>{point.name}</h3>
                      <p>{point.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <OpenSession
          eventId={event.id}
          disabled={event.status === "ended" || event.status === "cancelled"}
        />
      </div>
    </article>
  );
}
