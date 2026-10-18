import { OpenSession } from "@/components/sessions/open-session";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MapPin } from "lucide-react";
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

  return (
    <article className="place-detail">
      <Link href="/places" className="back-link">
        <ChevronLeft size={17} aria-hidden="true" />
        Todos los lugares
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
              Tu grupo se encuentra en el primer punto de la lista. Lo
              confirmamos cuando te unamos a un grupo.
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
        <OpenSession placeId={place.id} disabled={place.status !== "active"} />
      </div>
    </article>
  );
}
