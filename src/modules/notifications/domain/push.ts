/** What a browser hands over when it agrees to receive Web Push. */
export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * One notification. It carries only a room link and generic text: never names,
 * destinations or photos, because lock screens are public.
 */
export interface PushMessage {
  title: string;
  body: string;
  /** Same-origin path the notification opens. */
  url: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag: string;
}

/** `gone` means the push service forgot this browser; the subscription must be deleted. */
export type PushResult = "sent" | "gone" | "failed";

export interface PushSender {
  send(
    subscription: PushSubscriptionKeys,
    message: PushMessage,
  ): Promise<PushResult>;
}

/**
 * Push services browsers actually use. The server POSTs to whatever endpoint a browser
 * registers, so anything else is refused rather than letting a caller aim the server at
 * an internal address.
 */
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
];
const PUSH_SERVICE_SUFFIXES = [
  ".push.services.mozilla.com",
  ".push.apple.com",
  ".notify.windows.com",
];

export function isKnownPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "") return false;
  const host = url.hostname.toLowerCase();
  return (
    PUSH_SERVICE_HOSTS.includes(host) ||
    PUSH_SERVICE_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

const roomPath = (sessionId: string) => `/sessions/${sessionId}`;
const roomTag = (sessionId: string) => `room-${sessionId}`;

/** The room changes worth waking a phone for. */
export const roomMessages = {
  partyFormed: (sessionId: string): PushMessage => ({
    title: "Encontramos tu grupo de viaje",
    body: "Revisa la ruta y confirma tu lugar.",
    url: roomPath(sessionId),
    tag: roomTag(sessionId),
  }),
  partyConfirmed: (sessionId: string): PushMessage => ({
    title: "Todos confirmaron",
    body: "Quien reserva ya puede pedir el taxi. Ve al punto de encuentro.",
    url: roomPath(sessionId),
    tag: roomTag(sessionId),
  }),
  partyDissolved: (sessionId: string): PushMessage => ({
    title: "Tu grupo de viaje se deshizo",
    body: "Alguien salió. Te estamos buscando un grupo nuevo.",
    url: roomPath(sessionId),
    tag: roomTag(sessionId),
  }),
};
