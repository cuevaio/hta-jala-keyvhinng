# Jala — Product requirements document

Version 1.0 · 2026-10-18 · Hack the Andes 2026

Status: working MVP in source; demand and real-world outcomes remain unvalidated.
This document defines the current product contract and proposed next priorities.
“Implemented” means supported by source inspection, not a fresh production acceptance test.

## 1. Product and problem

Jala helps people leaving nearby locations at similar times find a small group to
share a taxi. A volunteer books the taxi in another service; Jala proposes the
drop-off order, recommends each rider's share and records group agreement and trip status.

The initial problem hypothesis is that people leaving a university, venue, mall or
station struggle to find compatible fellow riders and agree on a route and split.
Today they may travel alone or coordinate informally with people they already know.
These alternatives and the frequency/severity of the problem need interviews;
the repository contains no verified demand, savings or willingness-to-pay evidence.

**Primary job:** “When I am leaving, help me find nearby people going toward my
destination, agree on the shared trip and understand what I should pay.”

**Initial audience:** Spanish-speaking adults making near-term trips in Lima,
starting with one concentrated departure location and time window. This narrow pilot
is a proposed way to test liquidity; no venue partnership is established.

**Roles:** a rider supplies an origin, destination and departure preference; a
volunteer delegate also agrees to book externally and control trip start/completion.
A delegate is a fellow rider, not a driver supplied by Jala. Place administration
is a future operator role, currently served only by seed scripts.

## 2. Goals, assumptions and exclusions

The MVP must let independent accounts discover or create a compatible pool, form a
road-feasible party, inspect a consistent proposal, confirm and complete the trip.
It must explain the external booking/payment handoff and handle no-match and routing
failure without inventing a route.

The value hypothesis is lower individual travel expense and less coordination work.
Neither is established by a percentage allocation alone. Savings require comparing
real, contemporaneous solo quotes with the actual shared fare; coordination value
requires observing people arranging a departure.

Critical assumptions to test:

- Enough nearby people want compatible routes at the same time.
- Riders accept sharing exact destinations with their assigned party.
- Someone will volunteer to book and settle the taxi externally.
- Riders consider the proposed split understandable and acceptable.
- People can find one another at the suggested pickup without in-app contact.

Out of MVP scope: operating vehicles, driver dispatch, taxi-provider integration,
payment collection, guaranteed fares or savings, live vehicle tracking, identity
verification, a safety guarantee, emissions estimates and a commission business model.
A prepaid credit model is in place (PEN 5.00 welcome credit, PEN 1.00 per passenger
ride, delegates free; see `docs/domain-model.md`), but there is no top-up or real payment.

## 3. Current journey and terminology

1. On the home page, type directly into **Punto de partida** or press
   **Usar mi ubicación**; there is no starting-point dropdown. Continue to `/ride` to confirm the address
   search result or select a point on the map. GPS is requested only after pressing
   **Usar mi ubicación**, and is never required. Use one **Origen** field and one
   **Destino** field. Each field both
   displays the selected address and searches it with **Buscar** or Enter; choosing a
   result sets its map point. Editing an address clears its previous point until a new
   result or map point is selected. Geolocation is available for origin only. Choose
   now, 15, 30 or 60 minutes.
2. Search publicly for nearby compatible pools. Join one or create one; authentication
   is required for those mutations. The UI carries the draft through sign-in.
3. Wait in the shared room, optionally share its link, and request matching.
4. Inspect the saved pickup, ordered destinations, delegate, road estimates and shares.
5. Each party member confirms. The delegate books the taxi externally and marks start.
6. The delegate marks completion. Jala records completion; actual payment remains external.

The UI calls the **pool** (`session`, up to 20 waiting people) a “sala de espera” and the
**taxi party** (`ride_party`, 2–3 riders) a “grupo de viaje”; see the vocabulary in
`domain-model.md`.
A search result is a candidate pool, not a guaranteed seat in a feasible shared taxi.
Places are optional pickup anchors; selecting a place is no longer the mandatory entry.

## 4. Functional requirements and acceptance criteria

P0 preserves the core demo contract. P1 closes gaps before an unattended pilot.
P2 follows validated demand. Priorities below are proposed product decisions.

| ID | Priority / state | Requirement and acceptance criteria |
| --- | --- | --- |
| R1 | P0 / implemented | Visitors can search without signing in. Join/create require an account. The home page offers a starting-address field and **Usar mi ubicación** without a dropdown. Featured places remain optional shortcuts through their cards. Denied geolocation still permits manual address/map entry; a delayed GPS response must not replace a subsequent manual choice. Rehearse draft recovery through sign-in on the latest flow. |
| R2 | P0 / implemented | Discovery accepts pools within 1.5 km of origin, 3 km of the destination anchor and ±30 minutes of requested departure; ranks by normalized fit. Explain that these are straight-line discovery distances. |
| R3 | P0 / implemented | Creating a pool also joins its creator. Pickup uses an active place's meeting point when its place is within 400 m of origin, otherwise the origin itself. Joining rechecks server-side fit and capacity. |
| R4 | P0 / implemented | One waiting pool per person. Switching releases the previous waiting participation; an active forming/confirmed/in-progress party blocks switching. Pools close to joins 5 minutes after planned departure. |
| R5 | P0 / implemented | Matching runs automatically after each join and after a dissolve (ADR 0008; the button remains a manual retry) and proposes 2–3 riders within vehicle capacity, with exactly one volunteer assigned delegate and no rider above a 300-second estimated road detour. No volunteer or feasible partner leaves the rider waiting. |
| R6 | P0 / implemented | Matching processes at most 12 candidates per round and attempts at most eight full-route verifications. Prefer larger parties, then less summed detour, then shorter duration. This bounded heuristic makes no global-optimality promise. |
| R7 | P0 / implemented | Every member receives the same persisted route plan after refresh. Assigned retries create no duplicate party. Routing failure leaves assignments unchanged and provides a retryable error. |
| R8 | P0 / implemented | Split road segment distance among riders still aboard; normalize shares to exactly 10,000 basis points. A typed fare is apportioned in integer céntimos with no rounding loss. The fare calculator is display-only and its amount is not saved. |
| R9 | P0 / implemented | All members must confirm before starting. Only the delegate starts/completes. Leaving before departure cancels the party; leaving after start is rejected. Completion writes a ride record and updates completed-ride counts. |
| R10 | P0 / implemented, recheck UX | Explain destination sharing before matching. Exact destinations are visible to assigned party members, excluded from the general waiting roster. Unauthorized callers cannot obtain another party's plan. Public discovery still exposes pickup/destination anchors. |
| R11 | P1 / missing | After every member confirms, offer an explicitly consented contact handoff so riders can identify one another. Acceptance: members can coordinate pickup; nonmembers and unconfirmed parties cannot access contact details. Do not auto-publish phone numbers. |
| R12 | P1 / implemented | Opted-in riders get Web Push when a party forms, when everyone confirms and when their party dissolves ([notifications](notifications.md)). Denied permission preserves the polling room. iOS requires the home-screen app. Real-device delivery is not yet verified. |
| R13 | P1 / missing | Define confirmation deadlines, stalled-party expiry and no-show recovery. Acceptance: timed-out seats are released consistently; riders see their resulting state and can seek a new party. Join-window expiry alone does not satisfy this. |
| R14 | P2 / missing | Add place/meeting-point administration and arbitrary departure scheduling only after pilot learning supports them. Enforce authorization and valid coordinates/times. |

## 5. Product quality and technical constraints

- **Usability:** Spanish interface, Lima time and soles; demonstrate at 320 px and
  on a real phone. The latest geolocation/search/create flow needs fresh rehearsal.
  Confirm keyboard access, visible focus, announced errors and usable map alternatives;
  historical screenshots and automated accessibility results cover older slices.
- **Consistency:** database transactions and session locks protect joins, matching
  and lifecycle writes. Recheck the candidate snapshot after external routing; reject
  stale inputs rather than saving conflicting membership.
- **Security:** require authenticated ownership/membership and same-origin mutation
  checks; use password hashing, hashed session tokens and abuse limits. Audit deployed
  proxy headers and limit coverage before scaling. Login does not verify identity.
- **Privacy:** exact addresses also occur in ride draft query strings, and public
  discovery returns group anchors. Review URL/history/referrer exposure and anchor
  precision before collecting real home addresses. Keep research artifacts anonymized.
- **Dependencies:** PostgreSQL stores users, pools, memberships, plans and rides.
  OSRM supplies road estimates; Photon supplies search-as-you-type address lookup and
  Nominatim names map pins. Public endpoints
  are prototype dependencies; establish suitable services before sustained usage.
- **Estimates:** detours depend on routing estimates, not live traffic guarantees.
  A discovery fit can fail road matching. Do not promise a match or departure time.
- **Observability:** retain aggregate errors/latency and health checks without logging
  destinations or coordinates. No product analytics pipeline is established yet.

## 6. Evidence and success measures

The repository explicitly labels seeded participants fictional and reports no real
users. Previous engineering/browser checks demonstrate implementation, not traction.
No current interview dataset, real-trip results or retention evidence was found.

Use these proposed pilot gates; they are targets, not measured results:

| Question | Measure / collection | Initial gate |
| --- | --- | --- |
| Does the problem occur? | Five short interviews at one departure site; record recent behavior, existing workaround and hesitation | Repeated concrete examples from at least three people; otherwise reconsider the audience |
| Can people use it? | Five consented, independent task attempts on phones; log assistance and failure step | At least four reach a saved proposal without facilitator action, provided compatible riders and a delegate are available |
| Can a pool become a party? | Eligible waiters assigned / eligible waiters; time from join to proposal, including unmatched outcomes | Report counts and timing from the pilot; establish a baseline before setting a conversion promise |
| Does agreement hold? | Confirmed parties / proposed parties, time to all-confirmed, cancellations and reasons | Identify the dominant refusal or abandonment reason before expanding scope |
| Is there practical value? | For a voluntary real trip, record solo quotes, shared total, individual shares and coordination time | Report observed outcomes with consent; never infer savings from seeded fare examples |
| Will people return? | Consented follow-up after the next relevant departure opportunity | Treat stated interest separately from repeat use |

Begin with anonymized manual observation; instrument aggregate search, join, match,
confirmation and completion events later if useful. Exclude seed/demo accounts from
all adoption metrics. Do not require a real taxi trip to complete a usability study.

## 7. Hackathon guide and rubric alignment

Checked against the live [team guide](https://hacktheandes.com/guide) and
[submission terms](https://hacktheandes.com/participation-terms) on 2026-10-18.

Official rubric: integer scores 1–5; traction 30%, technical effort 40%, pitch 30%.
Score = traction × 6 + technical × 8 + pitch × 6. Interviews support traction;
stronger scores require stronger usage evidence. AI use alone is not penalized.

| Criterion | Jala evidence / next action |
| --- | --- |
| Traction | No external evidence found. Conduct the pilot above and preserve anonymized findings. |
| Technical effort | Show road matching, exact rounding, persisted proposals and concurrency protection; explain bounds and failure behavior. |
| Pitch | Rehearse one clear journey and state the contact, notification and validation gaps. |

Transport is the proposed track. Its Lima wording emphasizes public transport;
confirm shared-taxi positioning with organizers. Registration was not checked.

Required submission: deployment URL, presentation URL, repository URL and Markdown
description. Test links privately on another machine. Pitch: three minutes plus two
minutes Q&A. Complete checks before the jury snapshot; later edits do not update it.

## 8. Release plan and demonstration

### Before submission

1. Rehearse the latest location-first journey with separate browser accounts and a
   real phone. Include denied geolocation, empty results, no volunteer and routing failure.
2. Collect real observations and record what changed as a result. A testimonial or
   interview must be attributable privately with consent; public notes stay anonymized.
3. Verify current deployment parity and the presentation/repository links. An older
   verification document names `https://jala-chi.vercel.app`; that does not prove the
   latest commit is deployed. No current presentation URL was found in reviewed docs.
4. Make the demo self-contained. Existing solo rehearsals use a local `demo:crew`
   script for fictional riders; prepare an accessible public flow with independently
   controlled demo accounts before relying on it in the pitch. Keep fixtures fictional
   and disclose simulation; do not require destructive reseeding during presentation.
5. Retain concise technical evidence and limitations. Any public update/submission is
   a separate team action; this PRD does not publish one.

### After the demo, before an unattended pilot

Deliver R11 contact coordination, R12 notifications and R13 expiry/recovery. Review
destination exposure and obtain real-device/accessibility evidence. Use pilot
findings to choose the next change; avoid expanding into dispatch or payments first.

### Suggested three-minute narrative (team proposal)

| Time | Content |
| --- | --- |
| 0:00–0:30 | One rider's departure problem; show actual research if available, otherwise name the hypothesis. |
| 0:30–1:45 | Show search/create, a saved shared proposal, split and confirmations. Use prepared fictional peers if needed. |
| 1:45–2:20 | Explain road detour checks, consistent membership and exact monetary rounding. |
| 2:20–3:00 | State observed learning, external booking and the next pilot step. |

Prepare precise answers about trust, low demand, missing contact, routing outages,
fare fairness and what “completed” proves: it is a delegate action, not independent
verification that a taxi trip occurred.

## 9. Review findings and verification boundary

Reviewed source baseline: `0ba1caf` plus this documentation change. Inspected current
ride UI, group endpoints, affinity policy, road matcher, fare allocation, lifecycle
contract, architecture/status docs and historical evidence.

Checks in a fresh isolated worktree on 2026-10-18:

- ESLint passed.
- TypeScript passed after `next typegen`. Direct typecheck initially lacked generated
  route helpers; no application change was necessary.
- Vitest: 93 passed, 33 skipped across five integration files. Database/server-gated
  suites were not exercised. This is not a fresh verification of all 126 tests.
- No new production build, browser rehearsal, deployment verification or real-user
  test was performed for this documentation review.

Documentation drift: [matching.md](matching.md) still describes confirmation and
completion as future work and references an obsolete migration; [party-lifecycle.md](party-lifecycle.md)
and current source supersede those statements. Older frontend evidence also predates
location-first discovery. Do not use historical counts or screenshots as acceptance
evidence for the latest flow.

Open decisions: validate the target site's demand and acceptable pickup distance;
choose contact consent and timeout policies; confirm track positioning; establish
current submission links and an owner for pilot follow-up.

## 10. Source map

- [Current status](status.md), [architecture](architecture.md), [domain model](domain-model.md).
- [Location-first decision](decisions/0007-ride-groups-by-route-affinity.md),
  [affinity policy](../src/modules/sessions/domain/affinity.ts),
  [ride request UI](../src/components/sessions/ride-request.tsx).
- [Road matcher](../src/modules/matching/domain/road-matching.ts),
  [matching contract](matching.md), [historical checks](evidence/matching-checks.md).
- [Fare allocation](../src/modules/payments/domain/fare-allocation.ts),
  [lifecycle](party-lifecycle.md), [authentication](auth.md).
- [Local guide copy](hackathon-guide.md), [historical frontend verification](design/frontend-verification.md).
