import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { ChevronLeft, Clock3, MapPin, Users } from "lucide-react";
import { PlaceKindBadge } from "@/components/shared/place-kind-badge";
import { NotFoundError } from "@/lib/errors";
import { getServices } from "@/lib/services";
import { placeIdParams } from "@/modules/places/schemas/place.schema";

async function loadPlace(params: Promise<{ id: string }>) {
  const parsed = placeIdParams.safeParse(await params);
  if (!parsed.success) notFound();
  try {
    return await getServices().places.getById(parsed.data.id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/places/[id]">): Promise<Metadata> {
  await connection();
  const place = await loadPlace(params);
  return { title: place.name };
}

export default async function PlaceDetailPage({
  params,
}: PageProps<"/places/[id]">) {
  await connection();
  const place = await loadPlace(params);
  // Groups from a place meet at its first meeting point, or at the place itself.
  const [firstPoint] = place.meetingPoints;
  const start = firstPoint
    ? { ...firstPoint.location, label: `${place.name} · ${firstPoint.name}` }
    : { ...place.location, label: place.name };

  return (
    <article className="place-detail">
      <Link href="/places" className="back-link">
        <ChevronLeft size={17} aria-hidden="true" />
        Lugares frecuentes
      </Link>
      <div className="place-detail-grid">
        <div>
          <header className="place-heading">
            <div className="ticket-meta">
              <PlaceKindBadge kind={place.kind} status={place.status} />
              {place.isFictional && (
                <span className="fiction-label">
                  Lugar ficticio de demostración
                </span>
              )}
            </div>
            <h1>{place.name}</h1>
            {place.address && (
              <p className="place-fact">
                <MapPin size={19} aria-hidden="true" />
                {place.address}
              </p>
            )}
            <p className="place-description">{place.description}</p>
          </header>
          <section className="meeting-section" aria-labelledby="puntos">
            <h2 id="puntos">Puntos para encontrarse</h2>
            <p className="section-help">
              Los grupos que salen de aquí se encuentran en el primer punto de
              la lista.
            </p>
            {place.meetingPoints.length === 0 ? (
              <p className="empty-state">
                Aún no hay puntos definidos para este lugar.
              </p>
            ) : (
              <ul className="meeting-list">
                {place.meetingPoints.map((point) => (
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
        <aside className="join-pass">
          <div className="join-pass-content">
            <span className="join-pass-icon">
              <Users size={27} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <h2>
              Sal desde <br />
              aquí.
            </h2>
            <p>
              Elige a dónde vas y te mostramos los grupos que salen de este
              lugar hacia tu zona, o creas uno nuevo.
            </p>
            {place.status === "active" ? (
              <Link
                className="action action-primary"
                href={`/ride?${new URLSearchParams({
                  olat: String(start.latitude),
                  olng: String(start.longitude),
                  olabel: start.label,
                })}`}
              >
                Pedir un grupo desde aquí
              </Link>
            ) : (
              <span className="action action-primary" aria-disabled="true">
                Lugar cerrado
              </span>
            )}
          </div>
          <div className="join-pass-footer">
            <Clock3 size={17} aria-hidden="true" />
            <span>Sales ahora o dentro de 15, 30 o 60 minutos.</span>
          </div>
        </aside>
      </div>
    </article>
  );
}
