import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import {
  PLACE_KIND_ICONS,
  PlaceKindBadge,
} from "@/components/shared/place-kind-badge";
import type { Place } from "@/modules/places/domain/place";

export function PlaceCard({ place }: { place: Place }) {
  const Icon = PLACE_KIND_ICONS[place.kind];
  return (
    <Link href={`/places/${place.id}`} className="place-ticket">
      <div className="ticket-date" aria-hidden="true">
        <Icon size={38} strokeWidth={1.5} />
      </div>
      <div className="ticket-content">
        <div className="ticket-meta">
          <PlaceKindBadge kind={place.kind} status={place.status} />
          {place.isFictional && (
            <span className="fiction-label">Lugar ficticio</span>
          )}
        </div>
        <h2>{place.name.replace(/^\[DEMO\]\s*/, "")}</h2>
        {place.address && (
          <p>
            <MapPin size={16} aria-hidden="true" />
            {place.address}
          </p>
        )}
      </div>
      <span className="ticket-open">
        <span>Ver salida</span>
        <ChevronRight size={22} aria-hidden="true" />
      </span>
    </Link>
  );
}
