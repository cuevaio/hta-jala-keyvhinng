/** Browser side of Web Push: support detection, subscribe, unsubscribe. */

export type PushSupport = "available" | "needs-install" | "unsupported";

export function pushSupport(): PushSupport {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  // iOS only offers Web Push to apps added to the home screen (16.4+).
  if (ios && !installed) return "needs-install";
  return "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
    ? "available"
    : "unsupported";
}

function keyBytes(base64Url: string) {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) =>
  !!a &&
  a.byteLength === b.byteLength &&
  new Uint8Array(a).every((byte, i) => byte === b[i]);

/**
 * Subscribes this browser (asking permission if needed) and links it to the signed-in
 * account. Safe to repeat: it reuses the browser's subscription and re-links it, which
 * also moves a shared device to whoever is signed in now.
 */
export async function enablePush(publicKey: string) {
  if ((await Notification.requestPermission()) !== "granted")
    throw new Error("permission-denied");
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = keyBytes(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  // A rotated server key makes the old subscription undeliverable.
  if (
    subscription &&
    !sameKey(subscription.options.applicationServerKey, applicationServerKey)
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error("subscribe-failed");
}

/** Stops notifications on this browser. Call while still signed in, e.g. before sign-out. */
export async function disablePush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await fetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  // Even if the server call failed, the push service now answers 410 and we clean up.
  await subscription.unsubscribe();
}
