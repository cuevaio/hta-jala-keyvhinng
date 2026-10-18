import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { ArrowRight, ChevronLeft, Clock3, MapPin, Users } from "lucide-react";
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
        Lugares
      </Link>
      <div className="place-detail-grid">
        <div>
          <header className="place-heading">
            <PlaceKindBadge kind={place.kind} status={place.status} />
            <h1>{place.name}</h1>
            {place.address && (
              <p className="place-fact">
                <MapPin size={18} aria-hidden="true" />
                {place.address}
              </p>
            )}
            <p className="place-description">{place.description}</p>
          </header>
          <section className="meeting-section" aria-labelledby="puntos">
            <h2 id="puntos">Puntos para encontrarse</h2>
            <p className="section-help">
              Los grupos que salen de aquí se encuentran en el primer punto.
            </p>
            {place.meetingPoints.length === 0 ? (
              <p className="empty-state">
                Aún no hay puntos definidos para este lugar.
              </p>
            ) : (
              <ol className="meeting-list">
                {place.meetingPoints.map((point, i) => (
                  <li key={point.id}>
                    <span className="stop-index">{i + 1}</span>
                    <div>
                      <h3>{point.name}</h3>
                      <p>{point.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <aside className="join-pass">
          <span className="join-pass-icon">
            <Users size={24} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2>Sal desde aquí.</h2>
          <p>
            Dinos a dónde vas y te mostramos los grupos que salen de este lugar
            hacia tu zona, o creas uno nuevo.
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
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          ) : (
            <span className="action action-primary" aria-disabled="true">
              Lugar cerrado
            </span>
          )}
          <p className="join-pass-footer">
            <Clock3 size={16} aria-hidden="true" />
            Sales ahora o dentro de 15, 30 o 60 minutos.
          </p>
        </aside>
      </div>
    </article>
  );
}
