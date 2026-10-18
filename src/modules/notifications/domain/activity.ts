/** Saved ride updates contain no names, precise locations, photos, or chat text. */
export const activityMessages = {
  formed: {
    title: "Encontramos tu grupo",
    body: "Revisa la ruta y confirma tu lugar.",
  },
  confirmed: {
    title: "Todos confirmaron",
    body: "Ya pueden coordinar la reserva del taxi y el encuentro.",
  },
  dissolved: {
    title: "Tu grupo se deshizo",
    body: "Alguien salió del grupo. Abre la sala para revisar tu estado.",
  },
  expired: {
    title: "El grupo venció",
    body: "No se confirmó o inició a tiempo. Abre la sala para revisar tu estado.",
  },
  started: {
    title: "El viaje comenzó",
    body: "Puedes consultar la ruta y el reparto en tu sala.",
  },
  completed: {
    title: "El viaje finalizó",
    body: "Abre la sala para consultar el resumen del grupo.",
  },
};

export type ActivityKind = keyof typeof activityMessages;

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  sessionId: string;
  createdAt: string;
  readAt: string | null;
}

export interface ActivityFeed {
  items: ActivityItem[];
  unreadCount: number;
}
