// Jala service worker: shows room notifications and opens the room when one is tapped.
// It does not cache pages; the app needs the network to be useful.

self.addEventListener("push", (event) => {
  let message;
  try {
    message = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    (async () => {
      // An open room refreshes at once instead of waiting for its next poll.
      const windows = await self.clients.matchAll({ type: "window" });
      for (const client of windows)
        client.postMessage({ type: "room-changed", url: message.url });
      // Always show it: browsers penalise pushes that display nothing.
      await self.registration.showNotification(message.title, {
        body: message.body,
        tag: message.tag,
        renotify: true,
        icon: "/icon-192.png",
        data: { url: message.url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url ?? "/",
    self.location.origin,
  );
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const open = windows.find(
        (client) => new URL(client.url).pathname === target.pathname,
      );
      if (open) return open.focus();
      return self.clients.openWindow(target.href);
    })(),
  );
});
