# RFC 0001 – Pilot readiness: contact handoff, stalled-party expiry, and pilot measurement

**Status:** proposed · **Date:** 2026-10-18 · **Scope:** PRD R11, R12 (email only), R13 and §6 (evidence)

Inputs: [PRD](../prd.md), [status](../status.md), [hackathon guide and rubric](../hackathon-guide.md),
[party lifecycle](../party-lifecycle.md), ADRs [0005](../decisions/0005-leaving-dissolves-the-party.md)
and [0007](../decisions/0007-ride-groups-by-route-affinity.md).

## 1. Summary

The core journey (search → pool → road-matched party → confirm → start → complete) works.
Three gaps stop it from being usable by real people without a facilitator, and one gap
stops us from proving it works:

1. Matched riders cannot find each other (no contact path).
2. Nobody hears that a party formed or that everyone confirmed (the room only polls).
3. A party nobody confirms never expires, and a confirmed party nobody starts never ends.
4. Nothing turns real usage into numbers a juror can read.

This RFC proposes the smallest change set that closes all four, ordered by what each
one is worth against the judging rubric.

## 2. Why now: the rubric

Score per juror = traction × 6 + technical effort × 8 + pitch × 6 (each 1–5, max 100).
The jury sees a snapshot of links and updates taken when evaluation opens.

| Criterion (weight)  | Where Jala stands                                                                                   | What moves it                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Technical effort 40% | Strong: road matching with bounded search, integer-exact fare split, row-locked lifecycle, CI/CD with drift check. | Depth in the _hard_ parts (concurrency, time-based state), not more screens. |
| Traction 30%        | Nothing external. Seed data is fictional; no interviews or real trips recorded.                      | Interviews and any real use, logged and summarized with numbers.         |
| Pitch 30%           | Journey is demoable, but the demo needs `demo:crew` and a local script.                              | A self-contained demo and honest limits (PRD §8).                        |

A point on technical effort is worth 8 points; a point on traction is worth 6. But traction
is where Jala is weakest, and the largest single gain available is going from "no
external evidence" (1) to "interviews, some real usage" (3): +12. Technical work in this RFC
is chosen so it also _produces_ traction evidence (§5), rather than competing with it.

## 3. Goals and non-goals

**Goals**

- G1. Two matched strangers can coordinate pickup, with explicit consent and no leakage.
- G2. A rider is told by email when a party forms and when all have confirmed.
- G3. Every party reaches a terminal state without human intervention; seats are released.
- G4. One command prints the pilot metrics from PRD §6 from production data, without
  coordinates or identities.

**Non-goals**

- Chat, in-app messaging, push notifications and service workers.
- Background matching (still user-triggered), arbitrary departure times (R14), place admin.
- Identity verification, ratings, reporting. Fee ledger and payments.
- A product analytics pipeline or third-party tracker.

## 4. Proposal

### 4.1 Consented contact handoff (R11)

A member opts in per party. Nothing is shared by default and a phone number is never
published on the pool roster.

- **Schema (additive, nullable).** `ride_party_members.contact_phone text`,
  `contact_shared_at timestamptz`. The existing `users.phone` is not read: consent is
  per party, and the snapshot lets a member change their number without rewriting history.
- **Command.** New lifecycle command `share_contact` with `{ phone }` on
  `POST /api/sessions/:id/party`. Phone is validated as a Peruvian mobile
  (`+51 9XXXXXXXX`, normalized to digits). Allowed only when the party is `confirmed`
  or `in_progress` (everyone already agreed), by a member, and idempotent.
  Add it to `PARTY_COMMANDS` and `decide()` so the transition table stays the single
  source of truth.
- **Visibility rule.** The waiting-room payload for member _A_ includes `contact` for
  member _B_ only if the party is `confirmed`/`in_progress`, _A_ is in the party, and
  _B_ has `contact_shared_at` set. The server also requires that _A_ has shared, so the
  exchange is reciprocal: you see numbers only if you gave yours.
- **UI.** After the last confirmation, a card: "Compartir mi WhatsApp con el grupo"
  (explains who sees it). Once reciprocal, each peer shows a `wa.me/51…` link.
- **Erasure.** `contact_phone` is nulled when the party reaches `completed` or
  `cancelled`. Dissolve already deletes member rows (ADR 0005), so a leave erases it.

Tests: unit for the `decide()` rows (wrong state, non-member, idempotent); integration
for visibility (non-member, unconfirmed party, one-sided consent, post-completion
erasure) in `party-lifecycle.test.ts`.

### 4.2 Email notification on assignment and full confirmation (R12, reduced)

The `Mailer` port and Resend adapter already exist and are covered by tests. Reuse them.

- Emit after commit (never inside the session lock): when matching creates a party, mail
  each member "Encontramos un grupo"; when the last member confirms, mail "Todos
  confirmaron". Body contains the room link only, no destinations or other names.
- Delivery is best-effort. A mail failure is logged (`logger.warn`, no address) and never
  fails the request. This keeps matching and lifecycle atomic and independent of Resend.
- Gated on `RESEND_API_KEY`; without it the log mailer already warns in production.
- Opt-out is implicit for this RFC: only the two transactional messages above are sent.
  Any marketing or reminder email is out of scope.

Honest limit to state in the pitch: email is slow for a rider standing on a curb.
Push or SMS is the real answer and is deferred until a pilot shows email is the bottleneck.

### 4.3 Time-bounded parties (R13)

The domain currently has no clock. Add two deadlines and one sweeper.

| Deadline     | Column (nullable)                        | Default                              | When it fires                                                      |
| ------------ | ---------------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| Confirm-by   | `ride_parties.confirm_by timestamptz`    | creation + `PARTY_CONFIRM_TTL` (10 min) | `forming` and `now > confirm_by`                                   |
| Start-by     | `ride_parties.start_by timestamptz`      | session `departs_at` + 30 min, set when the party becomes `confirmed` | `confirmed` and `now > start_by`                                   |

Rows with a `NULL` deadline (created before the migration) never expire, which keeps
the migration safe under the expand-then-contract rule in [ci-cd.md](../ci-cd.md).

**Outcome of an expired `forming` party**

- Members who confirmed return to `waiting` and are eligible for the next match
  (same effect as ADR 0005, but they did nothing wrong).
- Members who did not confirm are set `no_show`, their participation `withdrawn`
  (they must re-join). `no_show` already exists in `MEMBER_STATUSES` but is unused.
- The party becomes `cancelled`; the plan is retained for audit as in ADR 0005.

**Outcome of an expired `confirmed` party** (nobody started): party `cancelled`, ride
`cancelled`, all members return to `waiting`. The delegate is not penalized in the
MVP; the count is reported in §4.4.

**Where it runs.** The app is serverless on Vercel, so there is no long-lived process.
Expiry is a pure function in `party-lifecycle.ts`
(`expiry(party, now): "none" | "release_forming" | "release_confirmed"`) applied by the
repository under the same session row lock used by joins, matching and lifecycle writes:

1. **Lazy sweep** on every read or write that touches the session (room load, party
   command, match request). Correct without any scheduler.
2. **Optional Vercel Cron** (every 5 min) calling an authenticated
   `/api/internal/sweep` as a backstop so abandoned rooms still free their seats.
   Authenticated with `CRON_SECRET`; if absent, the endpoint is not mounted.

`now` is injected, so every case is unit-testable without sleeping.

**Why lazy first:** it needs no infrastructure, cannot double-fire (same lock), and the
only observer who matters (a rider looking at the room) triggers the correction.
**Tradeoff:** a room nobody opens keeps its seats until the cron runs or someone
searches. Acceptable because those seats are not visible to anyone.

New ADR on acceptance: `0008-parties-expire-by-deadline`.

### 4.4 Pilot measurement without an analytics pipeline

The PRD forbids logging destinations or coordinates and says to start with anonymized
manual observation. So: no event table and no tracker. Compute the PRD §6 numbers from
data we already store.

`bun run pilot:report` (a read-only script, `scripts/pilot-report.ts`) prints, excluding
users flagged as seed/demo (by email domain, listed in the script):

- Pools created, joins, eligible waiters, waiters assigned to a party, unmatched.
- Parties proposed / all-confirmed / cancelled by cause (left, confirm timeout, start timeout).
- Median time join → proposal and proposal → all-confirmed (from `created_at` and the
  confirm timestamp; see below).
- Completed rides (delegate-reported; label as such).

Two small prerequisites so those times are knowable: `ride_party_members.confirmed_at`
and `ride_parties.cancel_reason` (enum-like text: `left`, `confirm_timeout`,
`start_timeout`). Both nullable, written by the existing transitions.

The script outputs counts only, so its output can be pasted into a public
`andes project update` without scrubbing. Fare savings are _not_ computed here (PRD
§2): they come from the manual log in §5.

## 5. Traction workstream (not code, same deadline)

The code above is only valuable for the rubric if it is exercised by people outside the team.

1. **Interviews (target ≥5).** One concentrated site. Ask for the last time they left
   that place, what they did, what it cost, what would stop them sharing. Record the
   answers in a private note; publish only anonymized summaries.
2. **Task tests (target ≥5).** Independent riders attempt the flow on their own phones.
   Log assistance and the step where they fail. This is also the real-device check the
   status doc lists as unverified.
3. **Post an update** with `andes project update` after each batch (decision made, test
   run, blocker). Updates are in the jury snapshot; late ones are not.
4. **Report outcomes, including failures** (e.g. "3 of 5 never found a compatible
   rider"). A negative result with numbers reads as stronger than silence.

The numbers in §4.4 give each update a concrete line to quote.

## 6. Demo and pitch implications

- **Self-contained demo.** The pitch runs on the organizers' machine from submitted links,
  so `demo:crew` cannot be the way peers confirm. Add a gated fictional-crew endpoint,
  enabled only when `DEMO_MODE=1` and only acting on accounts with the demo email
  domain, so a presenter can drive "the other two riders" from a second tab. Fixtures
  stay fictional and are disclosed as simulation (PRD §8).
- **Narrative (3 min).** Problem with real quotes (§5) → search/create → matched party →
  confirm → contact handoff → "a stalled party frees itself" (show the countdown) →
  observed numbers and next step. The expiry and contact consent are the answers to the
  trust and no-show questions the PRD tells us to prepare for.
- **State the limits:** straight-line discovery, public OSRM/Nominatim, delegate-reported
  completion, email-only notification, no identity verification.

## 7. Alternatives considered

| Alternative                              | Why not                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| Auto-share phone numbers on assignment   | Fails the PRD privacy constraint; asks for trust before the party agreed.                |
| In-app chat                              | A real-time store, moderation and abuse surface for a two-to-three person, ten-minute window. WhatsApp already exists on every phone. |
| Web push for notifications               | Service worker, permission UX, iOS home-screen requirement. Weeks of work for a demo-day gain smaller than email + contact. |
| Cron-only expiry                         | Needs infra to demo; lazy sweep is correct without it and cron can be added after.       |
| Third-party analytics (PostHog etc.)     | Sends location-adjacent behavior off-platform; PRD says no. SQL over existing tables is enough for N≈10. |
| Spend the time on background matching / arbitrary departure | Larger scope; neither is a blocker for the pilot, and "press the button" is explainable. |

## 8. Risks

- **Expiry races.** Sweep, confirm and leave all mutate a party. Mitigated by doing all
  three under the session lock and by `decide()` rejecting stale transitions; add a
  concurrent-confirm-vs-expiry integration test.
- **Clock skew** between app and database. Use the database `now()` for deadlines
  written and compared in SQL, not the app clock.
- **Ten-minute confirm window too short or too long.** It is a constant
  (`PARTY_CONFIRM_TTL`); pilot data from §4.4 sets it. Do not promise it publicly.
- **Phone numbers are personal data.** Scope is narrow (consented, party-only, erased on
  end) but still needs a one-line notice in the consent card and a note in
  [auth.md](../auth.md).
- **Email deliverability** from a new Resend domain; verify with a real inbox before
  relying on it (status doc lists this as unverified).
- **Time budget.** Everything here is additive, but it is a lot for the remaining hours.

## 9. Delivery plan and order

Ordered so that each step is independently shippable and the pitch is never worse than before.

| #   | Work                                                             | Rubric lever          | Rough size |
| --- | ---------------------------------------------------------------- | --------------------- | ---------- |
| 1   | Migration `0002`: nullable `confirm_by`, `start_by`, `confirmed_at`, `cancel_reason`, `contact_*` | enabler               | S          |
| 2   | `expiry()` pure function + lifecycle lazy sweep + tests          | technical effort      | M          |
| 3   | `share_contact` command, visibility rule, UI card + tests        | technical, pitch      | M          |
| 4   | `pilot:report` script                                            | traction              | S          |
| 5   | Email on assignment / all-confirmed                              | pitch                 | S          |
| 6   | `DEMO_MODE` fictional crew endpoint                              | pitch                 | S–M        |
| 7   | Optional cron backstop                                           | technical             | S          |

In parallel and ahead of 3–7: §5 interviews, which cost nothing in code and carry the
most rubric weight Jala has not yet earned.

Each step follows the repo workflow: own worktree, `lint`, `typecheck`, `test`, rebase,
fast-forward merge to `main`. Migration `0002` must be safe against the code still
serving traffic (all columns nullable), per [ci-cd.md](../ci-cd.md).

## 10. Open questions

1. Confirm shared-taxi positioning fits "Movilidad y Transporte" with the organizers
   (PRD §7); this affects the pitch framing, not the design.
2. Is the pilot site chosen? Interview target and `DEMO_MODE` domain depend on it.
3. Should a delegate who lets a confirmed party lapse be recorded (feeds a future
   reliability signal), or stay unpenalized in the MVP? Proposed: record, do not act.
4. Who owns pilot follow-up and the `andes project update` cadence?

## 11. Acceptance

This RFC is accepted when the team agrees on §4's scope and the §9 order. On acceptance:
add ADR 0008 (expiry), update `status.md` and `party-lifecycle.md` as each step lands,
and move R11/R13 from "missing" to "implemented" in the PRD only after the tests in §4
pass in CI.
