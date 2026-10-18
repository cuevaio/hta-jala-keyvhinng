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
| `completed`   | Delegate finished; members `dropped_off`, each user's `completed_rides` +1, passengers debited PEN 0.10 | – |
| `cancelled`   | Someone left (ADR 0005) or a deadline passed (ADR 0009) | – |

- `confirm`: idempotent. The last confirmation moves the party to `confirmed`.
- `leave`: before departure only (`409 ride_started` afterwards). Dissolves the party.
- `start`: delegate only (`403 delegate_required`).
- `complete`: delegate, or any member 30 minutes after the start (ADR 0009).
- Deadlines (ADR 0009): `confirm_by` = matched + 5 min, `start_by` = confirmed + 30 min.
  Missing one cancels the group; confirmers wait again, the others are released. Room
  polls, party commands and match requests sweep expired groups first.
- Other errors: `404 party_not_found`, `409 invalid_party_state`, `409 group_expired`,
  `429 rate_limited`.

Waiting seats (`POST /api/sessions/:id/seat`): `withdraw` leaves the room,
`offer_to_book` volunteers as the group's booker and rematches at once.

The waiting-room `party` includes `members: { participantId, status }[]` (identical
for every member) and `fareMinor`. The booker posts the taxi quote with
`{ "action": "set_fare", "fareMinor": 3240 }` (céntimos, forming or confirmed only).
Everyone then sees the same total, split into integer céntimos by the saved basis points
(`apportionMinor`), and confirms against it: `confirm` without a posted fare is
`409 fare_missing`. Changing the fare clears every confirmation, returns a confirmed
group to `forming` and restarts the confirmation window, so nobody is held to an amount
they did not see. Jala still neither books nor charges the taxi.

## Group chat

`GET /api/sessions/:id/party/messages?after=<seq>` and `POST` with `{ "body": "…" }`
(1–500 characters, trimmed). Only current members of the caller's party in that session
can read or write (`404 party_not_found` otherwise), so leaving or a dissolve ends access
and a re-match starts a fresh chat. Members write while the party is `forming`,
`confirmed` or `in_progress`; a `completed` party stays readable (`canPost: false`,
`409 chat_closed` on write). Posting is limited to 20 messages a minute per user.

Messages live in `party_messages` (migration `0002_party_messages`). `seq` is the read
cursor: a post locks the party row, so a party's messages commit in `seq` order and a
poll with the last seen `seq` never skips one. A post also bumps the room revision, and the
chat fetches new messages whenever the room poll sees a new revision (see the [room
revision contract](shared-session-contract.md#room-revision-and-polling)).

Demo: `bun run demo` migrates, seeds five fictional passengers and prints the session URL.
