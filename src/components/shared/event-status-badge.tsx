import type { EventStatus } from "@/modules/events/domain/event";
const labels: Record<EventStatus, string> = {
  scheduled: "Próximamente",
  active: "En curso",
  ended: "Finalizado",
  cancelled: "Cancelado",
};
export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className={`event-status event-status-${status}`}>
      <span aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
