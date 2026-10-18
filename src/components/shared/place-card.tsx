import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { PLACE_KIND_ICONS } from "@/components/shared/place-kind-badge";
import { PLACE_KIND_LABELS, type Place } from "@/modules/places/domain/place";

export function PlaceCard({ place }: { place: Place }) {
  const Icon = PLACE_KIND_ICONS[place.kind];
  return (
    <Link href={`/places/${place.id}`} className="place-card">
      <div className={`place-art place-art-${place.kind}`} aria-hidden="true">
        <Icon size={58} strokeWidth={1} />
      </div>
      <div className="place-info">
        <span className="place-kind">
          {PLACE_KIND_LABELS[place.kind]}
          {place.status === "inactive" && " · Cerrado"}
        </span>
        <h3>{place.name}</h3>
        {place.address && (
          <p>
            <MapPin size={14} aria-hidden="true" />
            <span>{place.address}</span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </p>
        )}
      </div>
    </Link>
  );
}
