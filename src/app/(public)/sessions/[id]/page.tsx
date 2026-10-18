import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { WaitingRoom } from "@/components/sessions/waiting-room";
import { NotFoundError } from "@/lib/errors";
import { ApiError } from "@/lib/http";
import type { Room } from "@/components/sessions/room";
import { readIdentity } from "@/modules/participants/infrastructure/browser-identity";
import { getServices } from "@/lib/services";
import { sessionIdParams } from "@/modules/sessions/schemas/session.schema";

async function loadSession(id: string) {
  try {
    return await getServices().sessions.getById(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

/** The viewer's room for the first paint; null when signed out or not yet a member. */
async function loadRoom(sessionId: string, userId: string | null) {
  if (!userId) return null;
  try {
    const room = await getServices().participation.waitingRoom(
      sessionId,
      userId,
    );
    // Dates become ISO strings, exactly as the polling endpoint returns them.
    return JSON.parse(JSON.stringify(room)) as Room;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return null;
    throw error;
  }
}

export default async function SessionPage({
  params,
}: PageProps<"/sessions/[id]">) {
  await connection();
  const parsed = sessionIdParams.safeParse(await params);
  if (!parsed.success) notFound();
  const session = await loadSession(parsed.data.id);
  const identity = await readIdentity();
  const initialRoom = await loadRoom(session.id, identity?.userId ?? null);
  return (
    <article className="session-page">
      <Link href="/ride" className="back-link">
        <ChevronLeft size={17} aria-hidden="true" />
        Buscar otro grupo
      </Link>
      <header className="session-heading">
        <h1>Tu grupo de salida.</h1>
        <p>{session.name}</p>
      </header>
      <WaitingRoom
        sessionId={session.id}
        group={{
          pickupLabel: session.pickupLabel,
          pickup: session.pickup,
          destinationLabel: session.destinationLabel,
          destination: session.destination,
          departsAt: session.departsAt.toISOString(),
        }}
        vehicleCapacity={session.vehicleCapacity}
        initialRoom={initialRoom}
        initialSignedOut={identity === null}
        accountName={identity?.displayName ?? ""}
        closesAt={session.closesAt.toISOString()}
        initiallyOpen={
          session.status === "open" &&
          session.opensAt <= new Date() &&
          session.closesAt > new Date()
        }
      />
    </article>
  );
}
