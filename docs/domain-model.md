# Domain model

```
Place 1 ──< Session 1 ──< RideParty 1 ── 1 Ride
  │             │              │
  │             │              └──< RidePartyMember >── 1 User
  │             └──< SessionParticipant >── 1 User
  └──< MeetingPoint ──< RideParty (chosen meeting point)

Ride 1 ──< FeeLedgerEntry >── 1 User
```

- **Place** – somewhere people leave together: a venue, university, mall or station. Has a location and predefined **MeetingPoints**.
- **Session** (the _pool_) – an open pool of people starting near the same pickup, heading
  to the same area and leaving around `departs_at`. Holds pickup and destination anchors and the
  vehicle capacity used for matching. `place_id` is set only when the pickup snapped to a place.
- **SessionParticipant** – a user in a session with their own start (origin), an exact destination (latitude/longitude) and
  a **delegate preference** (`delegate` | `passenger`). Unique per (session, user).
- **RideParty** – participants matched to share one vehicle. A session can produce many parties.
- **RidePartyMember** – a participant's place in a party. `role` is the _assigned_ role, kept
  separate from the stated preference. A partial unique index permits at most one delegate per
  party; finalization must also enforce at least one willing delegate. Stores the drop-off order and fare share.
- **Ride** – the actual coordinated journey for a party (one per party), with an external
  provider reference. Lifecycle: pending → requested → in_progress → completed | cancelled.
- **FeeLedgerEntry** – append-only record of the platform fee (`platform_fee`) or its waiver
  (`free_ride_waiver`, for the delegate) per user and ride; the audit trail for each user's credit balance.

## Vocabulary

Code, comments and docs are in English; user-facing strings are in Spanish. The UI uses
one term per concept and never calls the pool a "grupo".

| Concept                  | Code                        | Spanish UI             |
| ------------------------ | --------------------------- | ---------------------- |
| Pool of waiting people   | `Session`, `/api/groups`    | Sala de espera         |
| People sharing one taxi  | `RideParty`                 | Grupo de viaje         |
| The journey itself       | `Ride`                      | Viaje                  |
| Person booking the taxi  | `delegate`                  | Quien reserva el taxi  |
| Entry point (`/ride`)    | ride request                | Compartir un taxi      |

Entering a sala does not guarantee a ride: matching forms grupos de viaje of two or three
inside it. `/api/groups` and `GroupMatch` keep their names; they mean pools.

## Numeric conventions

- Money: integer minor units (`amount_minor`; PEN 0.10 = 10).
- Fare shares: integer basis points, 10,000 = 100% (`fare_share_bps`, 0–10,000 check constraint).
  `weightsToBasisPoints` uses largest remainder so shares always sum to exactly 10,000.
- Coordinates: WGS84 `double precision`, range-checked. No floating point for persisted money.

## Business rules (encoded so far)

- Every account starts with PEN 5.00 of prepaid credit (`users.credit_balance_minor`, default 500).
- When a ride completes, each passenger is debited PEN 0.10; the delegate rides free
  (`payments/domain/fees.ts`). Every member gets a `fee_ledger_entries` row (`platform_fee` or
  `free_ride_waiver`), written in the same transaction as the debit.
- Joining a sala requires credit for at least one ride (`402 insufficient_credit`), because
  matching may assign anyone the passenger role. The balance is not constrained to be
  non-negative: a ride that already happened is always recorded.
- The balance is shown in the header and on `/ride`. There is no top-up yet.
- No real payment processing; cash is settled between passengers.
