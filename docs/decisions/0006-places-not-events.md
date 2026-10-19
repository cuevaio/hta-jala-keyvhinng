# 0006 – Places, not events

**Status:** accepted (supersedes the event wording in 0004)

Jala is for anyone leaving a common place at the same time: a concert venue, a university,
a mall, a station. The model used to be built around `events` with `starts_at`/`ends_at`,
which excluded recurring, everyday departures.

- `events` became `places` with a `kind` (`venue`, `university`, `mall`, `transit`,
  `other`) and a status of `active` or `inactive`. There is no schedule on a place.
- Time lives on `sessions` (departure rooms): `opens_at`/`closes_at`, created on demand.
- `meeting_points.event_id` and `sessions.event_id` became `place_id`.
- Places have no directory page; the app snaps a ride origin to a nearby place and uses its
  meeting points.
- Because nothing is deployed yet, migrations were reset to one baseline (`0000`).
  Local databases need `bun run db:reset`. After launch, schema changes must be new
  additive migrations.

**Tradeoff:** a venue's concert nights are no longer first-class. If scheduled events
matter later, add them as an optional `place_events` table that opens sessions, rather
than putting dates back on `places`.
