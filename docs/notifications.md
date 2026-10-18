# Room notifications (Web Push)

People leave the room screen: the phone goes into a pocket while they wait at the exit.
Polling only works while the page is open, so the room changes that need someone to act
are also sent as Web Push notifications.

| Event                                  | Who is notified                                    | Text (Spanish UI)                  |
| -------------------------------------- | -------------------------------------------------- | ---------------------------------- |
| A party forms (automatic round)        | Every member, the person who just joined included  | "Encontramos tu grupo de viaje"    |
| A party forms (button pressed)         | Every member except whoever pressed it             | "Encontramos tu grupo de viaje"    |
| The last member confirms               | Every member except the last confirmer             | "Todos confirmaron"                |
| Someone leaves and the party dissolves | The members who stayed (then they are re-matched)  | "Tu grupo de viaje se deshizo"     |

Start and completion are not sent: the members are together in the taxi by then. Chat
messages are not sent yet; that needs per-party rate limiting first.

Notifications carry only a title, generic text and the room link. Lock screens are public,
so they never include names, destinations or photos. All of a room's notifications share
one tag (and Web Push topic), so a newer one replaces an older one instead of piling up.
They expire after 10 minutes (`TTL: 600`), since a stale "group found" is worse than none.

## Flow

1. After someone is in a room, the page offers **Activar avisos**. It never asks on page
   load: a refused browser prompt is close to permanent. Denied or unsupported browsers
   keep the polling room exactly as before.
2. The browser registers `/sw.js`, subscribes with the VAPID public key and posts the
   subscription to `POST /api/push/subscriptions`. One row per browser
   (`push_subscriptions`, migration `0006`); a browser belongs to the account that
   subscribed it last, so a shared device follows sign-ins. Sign-out calls
   `DELETE /api/push/subscriptions` and unsubscribes the browser first.
3. Route handlers schedule `roomEvents` with `after()` once the write has committed (see
   ADR 0008). `notifications.notify` fans out to every browser of the target accounts.
   Delivery is best effort and never throws. Push services answer 404/410 for browsers
   that unsubscribed, and those rows are deleted. Logs hold counts only, never endpoints.
4. The service worker shows the notification and tells any open Jala tab to poll at once.
   Tapping it focuses the room tab or opens the room.

## Abuse controls

- The server POSTs to whatever endpoint a browser registers, so endpoints must be HTTPS
  on a known push service (FCM, Mozilla, Apple, Windows) with no custom port. This keeps
  callers from pointing the server at internal addresses.
- Subscribing and unsubscribing require a signed-in, same-origin request and are limited
  to 10 per account per minute.

## Platform support

- Android (Chrome and other Chromium browsers), desktop Chrome, Edge, Firefox and Safari:
  work in a normal tab.
- iOS 16.4+: **only** after "Añadir a pantalla de inicio" (Jala ships a web app manifest
  for this). In a Safari tab the page shows install instructions instead of the button.

## Configuration

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and optional `VAPID_SUBJECT` (a `mailto:` or
`https:` contact for push services). Generate a pair once with
`bunx web-push generate-vapid-keys` and keep it: rotating the keys makes every existing
subscription undeliverable (browsers re-subscribe the next time they open a room).
Without both keys, the server only logs notifications and the page hides the button.

## Verification

Unit tests cover the fan-out, cleanup of gone endpoints, status mapping, the endpoint
allowlist and who is notified for each event. Integration tests cover subscription
storage. An HTTP run against a production build confirmed the full chain: the automatic
match notified the member, FCM rejected the fixture endpoint with 404, and the row was
deleted. **Not verified:** delivery to a real phone, Android or an installed iPhone app.
Run that once by hand and record it in `docs/evidence/`.
