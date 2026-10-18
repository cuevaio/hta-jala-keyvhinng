import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { MapPin } from "lucide-react";
import { PlaceCard } from "@/components/shared/place-card";
import { getServices } from "@/lib/services";
import { PLACE_KIND_LABELS, PLACE_KINDS } from "@/modules/places/domain/place";
import { listPlacesQuery } from "@/modules/places/schemas/place.schema";

export const metadata: Metadata = { title: "Lugares frecuentes" };

export default async function PlacesPage({
  searchParams,
}: PageProps<"/places">) {
  await connection();
  const { kind: rawKind } = await searchParams;
  const parsed = listPlacesQuery.safeParse({
    status: "active",
    kind: typeof rawKind === "string" ? rawKind : undefined,
  });
  const query = parsed.success ? parsed.data : listPlacesQuery.parse({});
  const places = await getServices().places.list({
    ...query,
    status: "active",
  });
  return (
    <div className="places-page">
      <header className="page-heading">
        <h1>¿De dónde salimos hoy?</h1>
        <p>
          Universidades, centros comerciales, conciertos y estaciones con puntos
          de encuentro definidos. ¿Estás en otro sitio?{" "}
          <Link href="/ride">Pide un grupo desde tu ubicación</Link>.
        </p>
      </header>
      <nav className="kind-filter" aria-label="Tipo de lugar">
        <Link
          href="/places"
          aria-current={query.kind ? undefined : "true"}
          className="chip"
        >
          Todos
        </Link>
        {PLACE_KINDS.map((kind) => (
          <Link
            key={kind}
            href={`/places?kind=${kind}`}
            aria-current={query.kind === kind ? "true" : undefined}
            className="chip"
          >
            {PLACE_KIND_LABELS[kind]}
          </Link>
        ))}
      </nav>
      {places.length === 0 ? (
        <div className="empty-state">
          <MapPin size={28} aria-hidden="true" />
          <h2>No hay lugares de este tipo todavía.</h2>
          <p>
            Prueba con otro filtro o{" "}
            <Link href="/ride">pide un grupo desde tu ubicación</Link>.
          </p>
        </div>
      ) : (
        <ul className="place-grid">
          {places.map((place) => (
            <li key={place.id}>
              <PlaceCard place={place} />
            </li>
          ))}
        </ul>
      )}
      <p className="page-note">Los lugares de esta demo son ficticios.</p>
    </div>
  );
}
