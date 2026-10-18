# Shared session milestone (Stage 0–1)

Implemented: place → open/reuse temporary session → exact destination and delegate preference → persisted waiting room. Road matching and saved group proposals are now implemented; see [the matching contract](matching.md). Verification, bookings and ride completion remain future milestones. No fares or payments are collected.

## HTTP contract

All endpoints use `{ data }` or `{ error: { code, message, details? } }`. IDs are UUIDs, timestamps ISO 8601 in JSON, coordinates WGS84 degrees. JSON mutations reject cross-origin requests.

| Endpoint | Input | Result |
| --- | --- | --- |
| `POST /api/auth/sign-up` | `{ displayName, email, password }` | 201 `{ userId, displayName }`, sets session cookie; 409 `email_taken` |
| `POST /api/auth/sign-in` | `{ email, password }` | `{ userId, displayName }`, sets a fresh session cookie; 401 `invalid_credentials` (same for unknown email and wrong password); 429 when throttled |
| `POST /api/auth/sign-out` | empty JSON | Deletes the server-side session and clears the cookie |
| `GET /api/auth/me` | session cookie | `{ userId, displayName }` or `null` |
| `GET /api/groups/search?olat&olng&dlat&dlng&depart` | none | Open groups that fit the ride, best first (ADR 0007) |
| `POST /api/groups` | join body + `departInMinutes` (0, 15, 30, 60), session cookie | New group (capacity 3) with the caller joined |
| `POST /api/sessions/:id/join` | `{ displayName, selfieDataUrl, originLabel, originLatitude, originLongitude, destinationLabel, latitude, longitude, delegatePreference }` (409 `group_mismatch` / `group_full` / `already_in_group`), session cookie | Own persisted participant; retries update the same row |
| `GET /api/sessions/:id/waiting-room` | member session cookie | `{ session, serverNow, me, participants, party, acceptingJoins }` |
| `GET /api/sessions/:id/participants/:participantId/selfie` | member of the same party | JPEG bytes, privately cacheable; 404 otherwise |
| `GET /api/sessions/:id/party/messages?after=<seq>` | party member session cookie | `{ canPost, messages: { seq, participantId, displayName, body, createdAt }[] }`, oldest first (see [party lifecycle](party-lifecycle.md)) |
| `POST /api/sessions/:id/party/messages` | `{ body }` (1–500 chars), party member session cookie | The saved message; 409 `chat_closed` after the trip, 429 when throttled |

`delegatePreference`: `delegate` or `passenger`. Names: 1–60 characters; destination label: 3–200 characters. Coordinates must be finite and in valid global ranges. A label and coordinates are user supplied and are not geocoded or independently verified. The form resolves an address or selects exact coordinates on a map.

The roster shares participant ID, display name, delegate preference and status only. While waiting, exact destinations and user IDs are returned only for the requesting participant (`me`). After matching, the saved `party.plan` shares destinations only among that party’s members. Public session detail/list endpoints still return summary/counts only. Members retain read access after pool expiry, but cannot join or update a closed pool.

Accounts: email + password (`users.email`, lowercased and unique; password 8–128 characters, hashed with scrypt N=2^17, r=8, p=1 and a per-user salt as `scrypt$N$r$p$salt$hash`). Joining or opening a session requires being signed in. The email is not verified and there is no password reset yet.

Cookie: random 256-bit bearer credential issued on sign-up/sign-in (a new one each time), HttpOnly, SameSite=Lax, Secure in production, seven-day expiry. Only its SHA-256 hash is stored in `browser_sessions`; sign-out deletes the row. Legacy anonymous guest users (no email) cannot sign in and their old cookies no longer authenticate.

Throttling: sign-in is limited to 10 attempts per email and 30 per client per 15 minutes, sign-up to 10 per client per hour. The limiter is in-memory and per process; use a shared store behind multiple instances. Per-email throttling also lets someone lock out a known email for the window.

Errors: 400 invalid input/JSON, 401 missing or expired identity, 403 nonmember/cross-origin request, 404 missing resource, 409 unavailable session/event or already matched, 415 non-JSON body. Unexpected database errors retain the common logged 500 envelope.

## Persistence and concurrency

- Additive migration `0001_unique_the_twelve.sql` adds browser credentials without changing existing records. Apply before deploying the new handlers; the previous app can coexist with this table.
- Place-row lock serializes open/reuse so simultaneous creates share one currently open pool. Expiry is checked against server time, with no scheduler needed.
- Session-row lock serializes joins; unique `(session_id, user_id)` prevents duplicate participation. Matching commits acquire the same lock and revalidate the candidate snapshot.
- A pool holds many waiting participants. Vehicle capacity limits future parties, not the pool size.
- Existing matched participants cannot rejoin as waiting. Matching persists parties and assignments atomically; see the matching contract for its invariants.
- Migration `0002_whole_young_avengers.sql` adds nullable `email`/`password_hash` to `users` (additive; existing guests are untouched). No identity-provider or payment credentials are needed. Expired browser credentials and abandoned users currently remain stored; add retention/cleanup before a broader launch.

## Next milestone contracts

Preserve existing domain interfaces in `src/modules`. Before parallel implementation, extend these together:

- Routing: ordered exact coordinates → road segments in meters/seconds with provider/source and explicit failure. Label fixture routing separately; never silently report straight-line estimates as live road routing.
- Matching: eligible snapshot + capacity 2–3 + detour limit → deterministic proposals and unmatched reasons. No willing delegate means waiting. Compare stop permutations locally; do not claim global optimality.
- Proposal: members, exactly one willing delegate, meeting point, ordered exact stops, per-member detours, integer fare shares totaling 10,000 basis points, and version.
- Acceptance: authenticated member accepts a current proposal version; lock assignment and reject stale proposals. One participant can belong to at most one active party.
- Lifecycle: waiting → proposed → confirmed → ready → completed, with cancellation and expiry. This is a target contract, not a claim about the current database enums or implementation.
- Completion: idempotent per-member ledger entries; first five completed rides waive only the platform fee; delegates always waive the platform fee while paying their taxi share. Taxi fare and boarding cash remain user coordinated.

## Verification

These commands prepare a local or disposable test database. Production migrations run automatically in [CI/CD](ci-cd.md) before deployment; no manual production migration is needed for a normal push to `main`.

```bash
bun run db:migrate # local/test database only
bun run lint
bun run typecheck
bun run test
# Against a migrated disposable/test database:
TEST_DATABASE_URL='postgres://...' bun run test tests/integration/participation.test.ts
bun run build
bun run start
# In another terminal, against the SAME database as the running app:
TEST_APP_URL=http://localhost:3000 TEST_DATABASE_URL='postgres://...' bun run test tests/integration/participant-api.test.ts
```

The integration suite creates unique fixtures and deletes only its own rows. It checks concurrent pool creation, concurrent duplicate joins, exact destination persistence, shared roster/privacy, membership enforcement, matched status, closed/future/expired pools, and cancelled events.

Browser rehearsal: open the same event in two independent browser profiles, enter the session, supply separate names/destinations, and join. Both should show the same roster within four seconds. Refresh both; identity and participation should persist. The shared URL is copied from the room. An unjoined browser should see the join form and cannot read the roster API.

## Public deployment gate

Public verification requires an authenticated Vercel account, selected team/project, a hosted Postgres database reachable from deployment, `DATABASE_URL` configured there, migration applied and a fictional demo event seeded explicitly. Do not point a public deployment at the developer's localhost database. The current `db:seed` script deletes fictional events and their sessions; never rerun it against a demo with participants you need to keep.

M1 is **publicly verified** at https://jala-chi.vercel.app (Vercel project `keyvhinngs-projects/jala`, Neon resource `jala-db`, Free plan, iad1). Both independent browsers joined and saw the same roster; polling and refresh persistence passed. See `docs/evidence/shared-session-checks.md`.

The initial milestone was deployed manually through the CLI. Current production releases use GitHub Actions: pushing to `main` runs verification, applies committed migrations to production, deploys, and smoke-tests the site. See [CI/CD](ci-cd.md) for the current release process. Production runtime error scan returned no error records during verification. User research and organizer rubric confirmation still require real people; no traction evidence is fabricated.

## Selfies

Creating or joining a room requires `selfieDataUrl`, a base64 JPEG capped at 150 KB. The browser resizes uploads to at most 400 pixels and removes metadata by rendering to canvas. Photos are stored per participation. The waiting-room response never embeds them: each assigned party member carries a versioned `selfieUrl` (`GET /api/sessions/:id/participants/:participantId/selfie?v=<ms>`) that returns the JPEG only to members of that same party (404 otherwise, including for “no photo”). The URL changes whenever the stored photo can change, so it is served `private, max-age=86400, immutable` and the 4-second room poll stays a few kilobytes instead of re-sending up to 450 KB of photos. A browser that already cached a photo keeps that private copy after the party dissolves. Waiting participants receive no other participant photos. Existing participations may have no photo and render an initial. The nullable `selfie_data_url` column is added by `0003_fearless_ezekiel.sql`. CI/CD applies this committed migration to production before deploying the new code. Run `bun run db:migrate` only when preparing a local or disposable test database. The upload validates face presence through `POST /api/selfies/validate`; create/join endpoints enforce the same check even when the upload UI is bypassed. Invalid images or photos with no detected face return 400 with a retry message; detector failures return 503 and never silently accept the image. A bundled BlazeFace model runs on the app server without third-party photo uploads or paid API credentials. Validation is limited to 10 requests per client per minute; direct joins are limited to 10 checks per account per minute. A bounded five-minute cache stores only photo hashes and successful checks. This is a visual identification aid: face presence does not verify identity or liveness.

## Room expiration

A room closes 30 minutes after its scheduled departure. No background timer or database status update is needed: server joins, search, and matching enforce the stored `closesAt` timestamp, and matching rechecks it under the session lock before committing. Existing parties remain usable after expiry.

The session page and private waiting-room response include server time; the public session detail response also includes `serverNow` with `Cache-Control: no-store`. The client anchors this time to a monotonic clock and updates its countdown every second independently of polling. Fresh samples on polling and tab visibility restore synchronization. Hidden tabs pause polling, and requests are cancelled on replacement/unmount and time out after 10 seconds.

The screen shows the closing time in Lima, a countdown, a warning in the final five minutes, and a closed state with a link to find another room. Closed rooms hide join, match, and invitation controls while retaining the roster and existing party access. The countdown is not a live region; phase changes are announced without reading every second aloud. The server remains authoritative when network latency makes the display approximate.
