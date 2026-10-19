# 0004 — Organize Jala around one complete group journey

Status: proposed implementation direction. This decision records the target design;
it does not claim that these capabilities are already implemented.

## Outcome

An event attendee enters an exact destination, receives a feasible shared-trip proposal,
accepts it, finds and verifies the group, follows external booking instructions, and
records completion. A second independent browser observes the same durable state.

Preserve the product rules: every exact destination is served; one willing delegate books
externally and pays their taxi share; taxi fare is unknown to Jala; recommendations are
percentages; cash is coordinated at boarding; the delegate's platform fee is waived;
the first five completed rides waive the passenger platform fee. Fee entries remain a
demonstration ledger, not payment collection.

## Keep

- One Next.js deployable and PostgreSQL, with the current Drizzle migrations.
- Opaque session cookies. Update: sign-up/sign-in (email + password, unverified email)
  now issues them, replacing anonymous guest identity, so the free-ride allowance can
  follow an account across browsers. Still not verified real-world identity.
- Short polling for small event pools; no realtime infrastructure until it is justified.
- Integer basis points and the tested rounding helper.
- Transactional joins, public deployment, and real database/HTTP integration tests.

Do not restart the app or introduce a new framework to correct domain modeling.

## One lifecycle owner

The shared trip group owns the lifecycle:

`proposed → confirmed → ready → completed`

A nonterminal group may also become `cancelled` or `expired`. Completed groups are terminal.

- **proposed:** immutable route-plan revision and membership are reserved; each member
  accepts that exact revision before its proposal deadline.
- **confirmed:** all members accepted; publish coordination details only to members.
- **ready:** all members completed group-membership verification. This does not prove
  identity, physical presence or that an external booking exists.
- **completed:** participants attest completion according to the explicit policy below;
  the server records the outcome and demo ledger exactly once.

Cancellation releases reservations atomically. A waiting participant can be proposed again
without deleting prior group history. A changed destination or route invalidates the old
proposal; confirmations never silently transfer to a different plan.

Do not maintain two independent lifecycle state machines on `ride_parties` and `rides`.
Keep the group authoritative; make the one-to-one ride record completion/booking metadata,
or consolidate the currently unused tables through a forward migration before use.
Member acceptance, verification and completion acknowledgements are per-member facts;
they are not alternative group lifecycle owners.

Completion policy for the demonstration: each member marks their own trip complete;
the group becomes completed when every member has acknowledged. Only then generate
ledger entries for all members in the same transaction. Repeated acknowledgement is safe.
Describe this as participant-reported completion, with no independent trip verification.

## Structural boundaries

`HTTP/UI adapters → application commands/queries → PostgreSQL`

Application commands call pure planning functions and a small routing boundary where needed.

- **Pure planning:** candidate eligibility, grouping heuristic, stop-order enumeration,
  detour checks, segment-based shares and platform-fee decisions. No framework, database
  or network imports.
- **Application commands:** request proposal, accept, cancel, verify, acknowledge completion.
  Own authorization, transaction boundaries, state transitions and domain errors.
- **Persistence:** explicit queries and constraints. Extract repository interfaces only
  where they provide a useful seam; do not add a pass-through service per table.
- **HTTP adapters:** validate input and translate domain errors to status codes. Domain
  and persistence code must not import `ApiError` from the Next.js response helper.
- **UI:** render one typed journey projection from server state, with pending/error states
  local to the browser. Never infer durable progress from which screen was last open.

Use three product areas: event/session participation, group journey, and route planning.
Identity and the demonstration ledger support these areas; they do not need independent
platforms. Avoid a large file-moving refactor before the first complete journey.

## Durable proposal contract

Persist an immutable route-plan revision before asking anyone to accept:

- proposal ID/revision, expiry and matching policy version;
- participant IDs and input revisions, exact destination snapshots;
- the one willing delegate;
- meeting-point snapshot and coordinates;
- ordered stops, segment distances in meters and durations in seconds;
- direct-trip baselines and extra time per member;
- nonnegative integer share basis points totaling 10,000;
- routing source, estimate timestamp and whether the result is a live estimate or fixture.

The plan provides one shared explanation for the UI, tests and pitch. Never recompute a
fresh plan during a read or acceptance, because that would change what people agreed to.

Use one road-routing provider behind a small function/adapter. Fetch road estimates once
for the candidate snapshot, use a bounded search for groups of two to four, compare their
stop orders locally and choose a feasible order. Do not promise global optimization.
No network request runs while a database transaction holds assignment locks.
A routing failure leaves participants waiting with an actionable reason; it must not
silently substitute straight-line distances as live road routing.

Fare shares: split each road segment equally among members still aboard, accumulate each
member's segment distance contribution, then normalize with the existing basis-point
rounding helper. Label this a distance-based recommendation, not an exact provider fare.
The delegate participates in the same taxi-fare allocation.

## Concurrency and database invariants

1. Snapshot eligible participants and their input revisions.
2. Obtain road estimates and calculate proposals outside the transaction.
3. Lock the session for a short transaction, re-read eligibility/revisions and expiry,
   then reserve participants and persist the plan atomically.
4. If the snapshot changed, discard the stale plan and return a retryable conflict.

For the current small pool, a session-level write lock is sufficient. All assignment and
release commands must follow that same lock protocol. Do not add distributed locks.

- Replace lifetime uniqueness on group membership with an explicit active reservation
  relation/assignment whose participant ID is unique. Historical memberships may repeat.
- Persist accepted plan revision per member; require current membership and revision for
  every mutation. Final acceptance and confirmation are one transaction.
- A unique delegate index enforces at most one delegate. Application validation must also
  enforce at least one, willingness, capacity, full route coverage and share totals.
- Each member has a unique completion/fee outcome per group. Add database uniqueness,
  rather than relying on a pre-insert existence check.
- Serialize completed-ride counters for affected users when applying fee rules. Completion,
  counter changes and ledger outcomes commit together; a retry cannot create more fees.
- Verification credentials are scoped to group/member, expire and are checked server-side.
  Start with a short-code workflow; QR can encode the same protocol later.

Evolve the deployed schema with forward migrations. There is no reason to wipe browser
identities or participation just because other domain tables are still unused.

## Highest-return delivery order

Each slice includes its schema, command, UI projection, meaningful tests and public verification.
Do not implement all backend modules before exposing a usable slice.

| Slice | Result | Required gate |
| --- | --- | --- |
| 1. Useful proposal | Attendee selects an exact destination on a map or resolves an address; compatible attendees get one explainable route proposal | Three browsers see the same saved route, delegate, stops and percentages; incompatible/no-delegate cases stay waiting |
| 2. Agreement | Members accept one proposal revision; cancellation releases everyone safely | Concurrent proposal requests cannot double-assign; stale acceptance fails; cancelled members can rematch |
| 3. Coordination | Confirmed group sees meeting instructions, verifies membership with short codes and copies the booking stop order | A fresh member can explain where to meet and who books; unrelated/expired codes fail |
| 4. Completion | Participant completion acknowledgements finalize the group and demo ledger | Repeated or concurrent completion cannot duplicate fees or counters; taxi share and platform fee remain distinct |

Removing manual latitude/longitude entry belongs in slice 1: it is a prerequisite for
meaningful user testing, not optional visual polish. Preserve exact chosen coordinates;
never substitute district centroids for destinations.

## Defer

NFC, driver operations, taxi-provider booking APIs, payment processing, chat, push,
advanced account login (OAuth, email verification, password reset, MFA), generalized provider registries, queues, event buses, microservices,
CQRS frameworks and infrastructure for hypothetical scale. QR is convenience after a
working short-code protocol. Build no generic transport platform.

## Evidence and delivery are part of the system outcome

- Confirm transport-track fit and the conflicting rubric weights with an organizer before
  substantial investment. Current published Lima wording emphasizes public transport;
  do not silently pivot the product or assume acceptance.
- Push a coherent, secret-free baseline so judges can review the deployed implementation.
  GitHub auto-deployment is useful, but the GitHub/Vercel integration is not a prerequisite
  for shipping a verified CLI deployment.
- Test with real target users as soon as slice 1 is available. Engineering/browser fixtures
  do not count as traction. Record observations and the changes they caused.
- Finish one complete public journey before optimizing the matcher or expanding features.
- Maintain a three-minute demo script and submit working application, presentation and
  repository links plus an accurate project description before the judging snapshot.

## Success measure

A new event attendee can coordinate one shared trip through Jala with other independent
participants, understand their exact stop and recommended share, and explain the delegate's
responsibility. The repository, public application and pitch demonstrate the same behavior.
