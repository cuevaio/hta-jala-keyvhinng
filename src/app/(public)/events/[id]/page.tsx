import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalendarDays, MapPin } from "lucide-react";
import { EventStatusBadge } from "@/components/shared/event-status-badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <article className="space-y-6">
      <header className="space-y-3">
        <EventStatusBadge status={event.status} />
        <h1 className="text-3xl font-extrabold tracking-tight">{event.name}</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden />
          <span className="capitalize">{formatEventDate(event.startsAt)}</span>
        </p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4" aria-hidden />
          {event.venueName}
        </p>
        <p>{event.description}</p>
      </header>

      <section aria-labelledby="puntos" className="space-y-3">
        <h2 id="puntos" className="text-lg font-bold">
          Puntos de encuentro
        </h2>
        {event.meetingPoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay puntos definidos.
          </p>
        ) : (
          <ul className="space-y-2">
            {event.meetingPoints.map((point) => (
              <li key={point.id}>
                <Card size="sm">
                  <CardContent>
                    <p className="font-semibold">{point.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {point.description}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
        Pronto podrás unirte a una sesión de este evento e indicar tu destino.
      </p>
    </article>
  );
}
