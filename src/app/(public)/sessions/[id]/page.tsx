import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { WaitingRoom } from "@/components/sessions/waiting-room";
import { NotFoundError } from "@/lib/errors";
import { getServices } from "@/lib/services";
import { sessionIdParams } from "@/modules/sessions/schemas/session.schema";

async function loadSession(id: string) {
  try {
    const services = getServices();
    const session = await services.sessions.getById(id);
    const place = await services.places.getById(session.placeId);
    return { session, place };
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export default async function SessionPage({
  params,
}: PageProps<"/sessions/[id]">) {
  await connection();
  const parsed = sessionIdParams.safeParse(await params);
  if (!parsed.success) notFound();
  const { session, place } = await loadSession(parsed.data.id);
  return (
    <article className="session-page">
      <Link href={`/places/${place.id}`} className="back-link">
        <ChevronLeft size={17} aria-hidden="true" />
        {place.name.replace(/^\[DEMO\]\s*/, "")}
      </Link>
      <header className="session-heading">
        <h1>Tu salida compartida.</h1>
        <p>{session.name}</p>
      </header>
      <WaitingRoom
        sessionId={session.id}
        placeId={session.placeId}
        vehicleCapacity={session.vehicleCapacity}
        mapCenter={place.location}
        closesAt={session.closesAt.toISOString()}
        initiallyOpen={
          session.status === "open" &&
          session.opensAt <= new Date() &&
          place.status === "active"
        }
      />
    </article>
  );
}
