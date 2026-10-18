# Shared session milestone (Stage 0–1)

Implemented: event → open/reuse temporary session → exact destination and delegate preference → persisted waiting room. Matching, groups, verification, bookings and ride completion are the next milestone. No fares or payments are collected.

## HTTP contract

All endpoints use `{ data }` or `{ error: { code, message, details? } }`. IDs are UUIDs, timestamps ISO 8601 in JSON, coordinates WGS84 degrees. JSON mutations reject cross-origin requests.

| Endpoint | Input | Result |
| --- | --- | --- |
| `POST /api/participant` | empty JSON | `{ userId }`, establishes/reuses browser cookie |
| `POST /api/sessions` | `{ eventId }`, browser cookie | Existing currently open pool or a new two-hour pool, capacity 3 |
| `POST /api/sessions/:id/join` | `{ displayName, destinationLabel, latitude, longitude, delegatePreference }`, browser cookie | Own persisted participant; retries update the same row |
| `GET /api/sessions/:id/waiting-room` | member browser cookie | `{ session, me, participants, acceptingJoins }` |

`delegatePreference`: `delegate` or `passenger`. Names: 1–60 characters; destination label: 3–200 characters. Coordinates must be finite and in valid global ranges. A label and coordinates are user supplied and are not geocoded or independently verified. The current form requires manual coordinates.

The roster shares participant ID, display name, delegate preference and status only. Exact destinations and user IDs are returned only for the requesting participant (`me`). Public session detail/list endpoints still return summary/counts only. Members retain read access after pool expiry, but cannot join or update a closed pool.

Cookie: random 256-bit bearer credential, HttpOnly, SameSite=Lax, Secure in production, seven-day expiry. Only its SHA-256 hash is stored in `browser_sessions`. This establishes membership, not verified identity. Separate browser profiles/private sessions represent separate users; tabs in one profile share identity. Clearing cookies loses access. No account recovery is provided yet.

Errors: 400 invalid input/JSON, 401 missing or expired identity, 403 nonmember/cross-origin request, 404 missing resource, 409 unavailable session/event or already matched, 415 non-JSON body. Unexpected database errors retain the common logged 500 envelope.

## Persistence and concurrency

- Additive migration `0001_unique_the_twelve.sql` adds browser credentials without changing existing records. Apply before deploying the new handlers; the previous app can coexist with this table.
- Event-row lock serializes open/reuse so simultaneous creates share one currently open pool. Expiry is checked against server time, with no scheduler needed.
- Session-row lock serializes joins; unique `(session_id, user_id)` prevents duplicate participation. Future matching/closing mutations must acquire the same lock.
- A pool holds many waiting participants. Vehicle capacity limits future parties, not the pool size.
- Existing matched participants cannot rejoin as waiting. Party assignment invariants are deferred until matching exists.
- No identity-provider or payment credentials are needed. Expired browser credentials and abandoned users currently remain stored; add retention/cleanup before a broader launch.

## Next milestone contracts

Preserve existing domain interfaces in `src/modules`. Before parallel implementation, extend these together:

- Routing: ordered exact coordinates → road segments in meters/seconds with provider/source and explicit failure. Label fixture routing separately; never silently report straight-line estimates as live road routing.
- Matching: eligible snapshot + capacity 2–3 + detour limit → deterministic proposals and unmatched reasons. No willing delegate means waiting. Compare stop permutations locally; do not claim global optimality.
- Proposal: members, exactly one willing delegate, meeting point, ordered exact stops, per-member detours, integer fare shares totaling 10,000 basis points, and version.
- Acceptance: authenticated member accepts a current proposal version; lock assignment and reject stale proposals. One participant can belong to at most one active party.
- Lifecycle: waiting → proposed → confirmed → ready → completed, with cancellation and expiry. This is a target contract, not a claim about the current database enums or implementation.
- Completion: idempotent per-member ledger entries; first five completed rides waive only the platform fee; delegates always waive the platform fee while paying their taxi share. Taxi fare and boarding cash remain user coordinated.

## Verification

```bash
bun run db:migrate
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

GitHub auto-linking failed during project creation, so this release was deployed through the CLI from the working tree. Push-based deployments are not yet connected. Production runtime error scan returned no error records during verification. User research and organizer rubric confirmation still require real people; no traction evidence is fabricated.
