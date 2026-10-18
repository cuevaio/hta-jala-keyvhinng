# Party lifecycle

`POST /api/sessions/:id/party` with `{ "action": "confirm" | "leave" | "start" | "complete" }`.
Requires same-origin credentials and membership in a party of that session. Decisions
live in `modules/parties/domain/party-lifecycle.ts` (one transition table, pure
functions); `party.repository.ts` applies them under the session row lock used by joins
and matching. No migration: statuses already existed in the schema.

| Party status  | Meaning                                  | Next                          |
| ------------- | ---------------------------------------- | ----------------------------- |
| `forming`     | Matched, waiting for every confirmation  | `confirmed`, `cancelled`      |
| `confirmed`   | Everyone agreed; `rides` row is `pending`| `in_progress`, `cancelled`    |
| `in_progress` | Delegate started the trip                | `completed`                   |
| `completed`   | Delegate finished; members `dropped_off`, each user's `completed_rides` +1 | – |
| `cancelled`   | Someone left (see ADR 0005)              | –                             |

- `confirm`: idempotent. The last confirmation moves the party to `confirmed`.
- `leave`: before departure only (`409 ride_started` afterwards). Dissolves the party.
- `start` / `complete`: delegate only (`403 delegate_required`).
- Other errors: `404 party_not_found`, `409 invalid_party_state`, `429 rate_limited`.

The waiting-room `party` now includes `members: { participantId, status }[]` (identical
for every member). The UI also offers a display-only fare calculator: the group types the
taxi fare and `apportionMinor` splits integer céntimos by the saved basis points.
Nothing about the fare is persisted and Jala still neither books nor charges the taxi.

Demo: `bun run demo` migrates, seeds five fictional passengers and prints the session URL.
