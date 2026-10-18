import { Users } from "lucide-react";

export default function Loading() {
  return (
    <div className="room-loading" role="status">
      <Users size={30} aria-hidden="true" />
      <p>Cargando…</p>
    </div>
  );
}
