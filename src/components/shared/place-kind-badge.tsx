import {
  Building2,
  GraduationCap,
  MapPin,
  Music,
  ShoppingBag,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import {
  PLACE_KIND_LABELS,
  type PlaceKind,
  type PlaceStatus,
} from "@/modules/places/domain/place";

export const PLACE_KIND_ICONS: Record<PlaceKind, LucideIcon> = {
  venue: Music,
  university: GraduationCap,
  mall: ShoppingBag,
  transit: TrainFront,
  other: MapPin,
};

export function PlaceKindBadge({
  kind,
  status,
}: {
  kind: PlaceKind;
  status: PlaceStatus;
}) {
  const Icon = PLACE_KIND_ICONS[kind] ?? Building2;
  return (
    <span className={`tag${status === "inactive" ? " tag-danger" : ""}`}>
      <Icon size={14} aria-hidden="true" />
      {PLACE_KIND_LABELS[kind]}
      {status === "inactive" && " · Cerrado"}
    </span>
  );
}
