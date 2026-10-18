import type { Metadata } from "next";
import { connection } from "next/server";
import { EventCard } from "@/components/shared/event-card";
import { getServices } from "@/lib/services";

export const metadata: Metadata = { title: "Eventos" };

export default async function EventsPage() {
  await connection(); // always render per request: events change over time
  const events = await getServices().events.list({ limit: 50 });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Eventos</h1>
      <p className="text-sm text-muted-foreground">
        Encuentra tu evento y comparte taxi con quienes van en tu dirección.
      </p>
      {events.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-muted-foreground">
          Aún no hay eventos disponibles.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
