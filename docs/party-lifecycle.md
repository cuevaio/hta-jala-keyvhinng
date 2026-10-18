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
| `cancelled`   | Someone left (see ADR 0005)              | –                             |

- `confirm`: idempotent. The last confirmation moves the party to `confirmed`.
- `leave`: before departure only (`409 ride_started` afterwards). Dissolves the party.
- `start` / `complete`: delegate only (`403 delegate_required`).
- Other errors: `404 party_not_found`, `409 invalid_party_state`, `429 rate_limited`.

The waiting-room `party` now includes `members: { participantId, status }[]` (identical
for every member). The UI also offers a display-only fare calculator: the group types the
taxi fare and `apportionMinor` splits integer céntimos by the saved basis points.
Nothing about the fare is persisted and Jala still neither books nor charges the taxi.

## Group chat

`GET /api/sessions/:id/party/messages?after=<seq>` and `POST` with `{ "body": "…" }`
(1–500 characters, trimmed). Only current members of the caller's party in that session
can read or write (`404 party_not_found` otherwise), so leaving or a dissolve ends access
and a re-match starts a fresh chat. Members write while the party is `forming`,
`confirmed` or `in_progress`; a `completed` party stays readable (`canPost: false`,
`409 chat_closed` on write). Posting is limited to 20 messages a minute per user.

Messages live in `party_messages` (migration `0002_party_messages`). `seq` is the read
cursor: a post locks the party row, so a party's messages commit in `seq` order and a
poll with the last seen `seq` never skips one. The room polls every three seconds while
the tab is visible; there is no push, so a closed tab learns nothing.

Demo: `bun run demo` migrates, seeds five fictional passengers and prints the session URL.
