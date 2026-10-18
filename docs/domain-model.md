# Domain model

```
Event 1 ──< Session 1 ──< RideParty 1 ── 1 Ride
  │             │              │
  │             │              └──< RidePartyMember >── 1 User
  │             └──< SessionParticipant >── 1 User
  └──< MeetingPoint ──< RideParty (chosen meeting point)

Ride 1 ──< FeeLedgerEntry >── 1 User
```

- **Event** – a concert, play or festival. Has a venue and predefined **MeetingPoints**.
- **Session** – a temporary pool of passengers for an event or departure window. One event can
  have many sessions. Holds the vehicle capacity used for matching.
- **SessionParticipant** – a user in a session with an exact destination (latitude/longitude) and
  a **delegate preference** (`delegate` | `passenger`). Unique per (session, user).
- **RideParty** – participants matched to share one vehicle. A session can produce many parties.
- **RidePartyMember** – a participant's place in a party. `role` is the _assigned_ role, kept
  separate from the stated preference. A partial unique index permits at most one delegate per
  party; finalization must also enforce at least one willing delegate. Stores the drop-off order and fare share.
- **Ride** – the actual coordinated journey for a party (one per party), with an external
  provider reference. Lifecycle: pending → requested → in_progress → completed | cancelled.
- **FeeLedgerEntry** – append-only record of the platform fee (`platform_fee`) or its waiver
  (`free_ride_waiver`) per user and ride.

## Numeric conventions

- Money: integer minor units (`amount_minor`; PEN 0.10 = 10).
- Fare shares: integer basis points, 10,000 = 100% (`fare_share_bps`, 0–10,000 check constraint).
  `weightsToBasisPoints` uses largest remainder so shares always sum to exactly 10,000.
- Coordinates: WGS84 `double precision`, range-checked. No floating point for persisted money.

## Business rules (encoded so far)

- Regular passengers ride free for their first five completed rides; afterwards PEN 0.10 per ride.
  Delegates never pay (`payments/domain/fees.ts`). `users.completed_rides` is a denormalised counter.
- No real payment processing; cash is settled between passengers.
