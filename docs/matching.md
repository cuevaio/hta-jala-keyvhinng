# Road matching

Implemented slice: signed-in attendee → join a session → automatic matching round after
the join (ADR 0008; **Buscar compañeros ahora** retries by hand) → saved shared-trip proposal. The waiting-room poll shows the same persisted plan to every
member. Matching does not book a taxi or collect money. Group acceptance, cancellation,
expiry, verification and completion are separate future slices; assignment currently
lasts for the session and the existing participant uniqueness constraint is retained.

## Policy `road-v1`

- Groups contain two to four people, never more than the session vehicle capacity.
- Exactly one member who explicitly volunteered is assigned delegate. Additional
  volunteers can be passengers. No volunteer or no compatible partner means waiting.
- Pickup is the group's saved pickup (`sessions.pickup_*`): the earliest meeting point of the
  anchoring place, the place itself, or the creator's own start. Coordinates and label are saved.
- Maximum detour is 300 seconds per person compared with a direct road trip from
  pickup to their exact destination. Arrival times include all preceding stops.
- Directed road times come from one OSRM table request. Enumerate feasible ordered
  groups of two to four locally, prefer larger groups, then lower summed detour, then shorter
  duration. Input order breaks ties. Greedily take disjoint groups: this is a heuristic,
  not a globally optimal allocation.
- Each round considers at most 12 waiters: the requester, then oldest participants;
  include an oldest available volunteer if this batch otherwise has none. Large pools
  can need several rounds. At most eight full-route verifications are attempted per
  round, with five-second request timeouts. Full-route detours are rechecked because
  turn restrictions can differ from independent matrix legs. A verification limit
  leaves the remaining participants waiting.
- Null road matrix entries are unreachable. Provider errors fail the round without
  writes; no straight-line fallback is presented as road routing.
- Each road segment is shared equally among people still aboard. Distance contributions
  become integer basis points totaling 10,000 using largest-remainder rounding. The
  delegate pays their share. This is a recommendation, not an external taxi fare.

## API

`POST /api/sessions/:id/match` requires same-origin session credentials and existing
session membership. Constraints come from the server, not the request body. Returns
`{ data: { createdPartyCount, alreadyMatched } }`. Request the waiting-room projection
for the requester's resulting group (a round can create groups for other waiters).

- 401: no signed-in account; 403: nonmember/cross-origin request.
- 404: unknown session; 409 `session_unavailable`: closed/future/expired session or
  inactive place; 409 `matching_snapshot_changed`: inputs changed, retry.
- 429: more than six matching requests per account per minute (existing per-process
  limiter; multiple production instances need a shared limit).
- 503 `routing_unavailable`: routing timed out, failed or returned invalid data;
  people remain waiting. An assigned member's retry succeeds without routing/writes.

`GET /api/sessions/:id/waiting-room` now includes `party: null | { id, status, plan }`.
Only the requesting participant's party is returned. Its immutable plan includes policy
version, routing source, estimate timestamp, pickup, exact ordered destinations, member
roles, direct/arrival/detour seconds, road segments, geometry when available, and fare
shares. Group members see each other's destinations; the wider waiting-room roster
continues to omit them. The waiting UI explains this before matching.

## Persistence and concurrency

Apply additive migration `0003_nappy_viper.sql` before deploying: nullable
`ride_parties.route_plan` JSONB allows older rows/readers to coexist. Older servers
cannot render the new plans, so deploy the updated waiting-room reader with the matcher.
This release does not rewrite historical parties or enable cancellation/rematching.

Snapshot candidates, obtain routing and calculate plans **outside** a transaction. For
commit, lock the session row (same protocol as joins), recheck membership, place/session
availability, pickup, capacity and all candidate inputs, then write parties, members and
matched participant states together. Concurrent assigned retries return success; stale
unassigned snapshots return a conflict. Existing unique participant/delegate constraints
provide a second line of defense. Reads use one repeatable-read transaction so a poll
cannot mix pre-assignment membership with a post-assignment group.

Sessions remain open for unmatched participants and subsequent rounds. Individual
participant states represent assignments; the session is not marked fully matched.
Logs include session ID and aggregate counts, never addresses or coordinates.

## Configuration and verification

`ROUTING_BASE_URL` selects an OSRM-compatible server (defaults to its public demo).
Provision an appropriate road-routing service for sustained traffic. Saved plans created
by the production composition root identify their source as `osrm`; test-injected
providers identify themselves as `fixture`.

```sh
bun run db:migrate
bun run lint
bun run typecheck
bun run test
TEST_DATABASE_URL='postgres://...' bun run test -- tests/integration/matching.test.ts tests/integration/participation.test.ts
bun run build
```

Integration tests create unique fixtures and remove only those rows. They cover shared
persisted plans, membership privacy, matched retries, concurrent matching, stale input,
routing failures, no-volunteer waiting and expiry. Unit tests exercise directed detours,
capacity, unreachable routes, full-route revalidation, malformed responses and invariant
checks over deterministic varied road networks.

Browser rehearsal: sign in using separate accounts in independent browser sessions,
join the same place session with nearby exact destinations, volunteer on one account,
and wait for the automatic round (or select **Buscar compañeros ahora**). Verify the group/stop/share details appear in every member's
poll and persist on refresh. A fourth unassigned attendee must not receive that plan.
