# Project status

_Last updated 2026-10-18. Everything seeded is fictional; there are no real users._

Jala lets people leaving the same place (concert venue, university, mall, station) share a
taxi: it groups compatible destinations by road time, shows each person's share of the fare,
and tracks the group through confirm, start and finish. Jala does not book or charge the taxi.

## Journey coverage

| Step                                                       | State       | Notes                                                                 |
| ---------------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| Sign up, sign in, sign out                                 | Done        | scrypt, hashed session tokens, Postgres-backed rate limits            |
| Password reset and change                                  | Done        | Emails go through Resend when `RESEND_API_KEY` is set; log-only otherwise |
| Choose starting location, destination and time          | Done        | Home offers a starting-address field and current-location button; opt-in GPS, address search or map pin on `/ride`; now / 15 / 30 / 60 min |
| Find open groups by route affinity, or create one          | Done        | ADR 0007; pickup 1.5 km, destination 3 km, departure ±30 min          |
| Browse places, filter by kind                              | Done        | Optional pickup anchors; start a request from a place                 |
| Join with exact destination (map pin or address search)    | Done        | Reverse and forward lookup via public Nominatim                       |
| Match into groups of 2–3 by road time                      | Done        | OSRM, 5-minute detour cap, one booker per group; automatic (ADR 0008) |
| Saved route plan, route map, fare shares                   | Done        | Basis points; soles view from a fare the group types in               |
| Confirm, leave, start, complete                            | Done        | Leaving dissolves the group (ADR 0005); only the booker starts/ends   |
| Ride record and completed-ride counter                     | Done        | `rides` row; `users.completed_rides` incremented                      |
| Share the room (copy link, WhatsApp)                       | Done        |                                                                       |
| Contact between group members                             | Done        | Group chat in the room (polling, quick replies); read-only after the trip; no phone or push |
| Notifications (group found, everyone confirmed)            | **Missing** | The room polls; a closed tab learns nothing                           |
| Arbitrary departure time ("I leave at 10 pm")              | **Missing** | Only now / 15 / 30 / 60 minutes                                       |
| Background matching                                        | Done        | Runs after each join and after a dissolve (ADR 0008); button retries  |
| Expiry of stalled groups, no-show handling                 | **Missing** | A group nobody confirms never expires                                 |
| Identity or email verification, ratings, reporting, blocks | **Missing** | `verified` / `no_show` member states exist but are unused             |
| Fee ledger entries on completion                           | **Missing** | Rule and table exist; nothing writes entries; fare is never persisted |
| Create places and meeting points                           | **Missing** | Only the seed script does it; no admin UI or API                      |
| Real taxi booking                                          | Out of scope | Intentional; the booker orders in another app                         |

Rough estimate: the core path from "I am leaving" to "trip finished" is about 80% done; the
whole product is about half.

## Verified

- 104 automated tests pass (unit and Postgres integration; set `TEST_DATABASE_URL`). ESLint,
  `tsc` and a production build pass.
- The full journey was walked in a real browser at desktop and 320 px widths: sign up, join,
  match against the live routing server, confirm, start, complete. A solo demo needs
  `bun run demo:crew <sessionId> confirm|start|complete` to act as the fictional passengers.
- **Not verified:** a real phone (iOS input zoom, two-finger map), screen readers, the
  invalid-fare and persistent-error messages on screen, and Resend delivery to a real inbox.
- There is no automated browser test of the journey.

## Known risks

- Routing (OSRM) and address lookup (Nominatim) use public demo servers; neither is meant
  for sustained traffic.
- `x-forwarded-for` is trusted for per-client rate limits; deploy behind a proxy that sets it.
- Migrations were reset to one baseline (`0000`) before launch. After the first deploy, only
  add new migrations. Local databases need `bun run db:reset`.
- The stylesheet is hand-written (about 2,200 lines) and does not use the installed
  Tailwind/shadcn components or success/warning tokens.

## Next, in order

1. Real-device check of geolocation and the new ride flow.
2. Notify people when a group forms and when everyone has confirmed.
3. Expire stalled groups and handle no-shows.
4. Minimal admin page to create places and meeting points.

## Where things are documented

| Topic                              | Doc                                                                  |
| ---------------------------------- | -------------------------------------------------------------------- |
| Architecture and modules           | [architecture.md](architecture.md), [domain-model.md](domain-model.md) |
| Matching policy and API            | [matching.md](matching.md)                                           |
| Group lifecycle                    | [party-lifecycle.md](party-lifecycle.md)                             |
| Accounts, sessions, abuse controls | [auth.md](auth.md)                                                   |
| Join and waiting-room contract     | [shared-session-contract.md](shared-session-contract.md)             |
| UX review and what was fixed       | [design/ux-pass.md](design/ux-pass.md)                               |
| Decisions                          | [decisions/](decisions/) (0005 leaving dissolves, 0006 places, 0007 ride groups, 0008 automatic matching) |
