import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { EventStatusBadge } from "@/components/shared/event-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Event } from "@/modules/events/domain/event";
import { formatEventDate } from "@/lib/utils";

export function EventCard({ event }: { event: Event }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold leading-snug">
              {event.name}
            </h2>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            <span className="capitalize">
              {formatEventDate(event.startsAt)}
            </span>
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {event.venueName}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
