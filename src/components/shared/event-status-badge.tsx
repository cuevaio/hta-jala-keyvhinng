import { Badge } from "@/components/ui/badge";
import type { EventStatus } from "@/modules/events/domain/event";

const labels: Record<EventStatus, string> = {
  scheduled: "Próximamente",
  active: "En curso",
  ended: "Finalizado",
  cancelled: "Cancelado",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge variant={status === "active" ? "default" : "secondary"}>
      {labels[status]}
    </Badge>
  );
}
